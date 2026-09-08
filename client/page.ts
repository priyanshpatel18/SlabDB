import { createHash } from "crypto";
import {
  COL_BOOL,
  COL_INT4,
  COL_INT8,
  COL_TEXT,
  COL_TIMESTAMPTZ,
  PAGE_BYTES,
  PAGE_HEADER,
  TEXT_MAX_BYTES,
  type Column,
  type ColTypeName,
  type Row,
  type SqlValue,
} from "./types";

export function sha256(data: Buffer): number[] {
  return Array.from(createHash("sha256").update(data).digest());
}

export function sha256Hex(data: Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

export function colTypeFromU8(typ: number): ColTypeName {
  switch (typ) {
    case COL_BOOL:
      return "bool";
    case COL_INT4:
      return "int4";
    case COL_INT8:
      return "int8";
    case COL_TEXT:
      return "text";
    case COL_TIMESTAMPTZ:
      return "timestamptz";
    default:
      throw new Error(`unknown column type ${typ}`);
  }
}

export function colTypeToAnchor(typ: ColTypeName): Record<string, Record<string, never>> {
  return { [typ]: {} };
}

export function encodePk(value: SqlValue, typ: ColTypeName): { key: number[]; keyLen: number } {
  const raw = encodeValue(value, typ);
  const key = Buffer.alloc(32);
  const keyLen = Math.min(raw.length, 32);
  raw.copy(key, 0, 0, keyLen);
  return { key: Array.from(key), keyLen };
}

export function encodeValue(value: SqlValue, typ: ColTypeName): Buffer {
  switch (typ) {
    case "bool": {
      const buf = Buffer.alloc(1);
      buf.writeUInt8(value ? 1 : 0, 0);
      return buf;
    }
    case "int4": {
      const buf = Buffer.alloc(4);
      buf.writeInt32LE(Number(value), 0);
      return buf;
    }
    case "int8": {
      const buf = Buffer.alloc(8);
      buf.writeBigInt64LE(BigInt(value), 0);
      return buf;
    }
    case "text": {
      const text = String(value);
      if (text.length > TEXT_MAX_BYTES) {
        throw new Error(`text longer than ${TEXT_MAX_BYTES} bytes`);
      }
      const body = Buffer.from(text, "utf8");
      if (body.length > TEXT_MAX_BYTES) {
        throw new Error(`text longer than ${TEXT_MAX_BYTES} bytes`);
      }
      const buf = Buffer.alloc(2 + body.length);
      buf.writeUInt16LE(body.length, 0);
      body.copy(buf, 2);
      return buf;
    }
    case "timestamptz": {
      const buf = Buffer.alloc(8);
      buf.writeBigInt64LE(BigInt(value), 0);
      return buf;
    }
  }
}

export function decodeValue(buf: Buffer, off: number, typ: ColTypeName): { value: SqlValue; next: number } {
  switch (typ) {
    case "bool":
      return { value: buf.readUInt8(off) !== 0, next: off + 1 };
    case "int4":
      return { value: buf.readInt32LE(off), next: off + 4 };
    case "int8":
      return { value: buf.readBigInt64LE(off), next: off + 8 };
    case "text": {
      const len = buf.readUInt16LE(off);
      const start = off + 2;
      const value = buf.slice(start, start + len).toString("utf8");
      return { value, next: start + len };
    }
    case "timestamptz":
      return { value: buf.readBigInt64LE(off), next: off + 8 };
  }
}

export function encodeTuple(columns: Column[], row: Row): Buffer {
  const parts: Buffer[] = [];
  for (const col of columns) {
    const v = row[col.name];
    if (v === undefined || v === null) {
      if (col.notNull) {
        throw new Error(`column ${col.name} is NOT NULL`);
      }
      throw new Error(`column ${col.name} is missing`);
    }
    parts.push(encodeValue(v, col.typ));
  }
  return Buffer.concat(parts);
}

export function packPage(relOid: number, pageNo: number, tuples: Buffer[]): Buffer {
  const used = PAGE_HEADER + tuples.reduce((n, t) => n + t.length, 0);
  if (used > PAGE_BYTES) {
    throw new Error(`page overflow: ${used} > ${PAGE_BYTES}`);
  }
  const page = Buffer.alloc(PAGE_BYTES);
  Buffer.from("SLAB").copy(page, 0);
  page.writeUInt8(1, 4);
  page.writeUInt32LE(relOid, 5);
  page.writeUInt32LE(pageNo, 9);
  page.writeUInt16LE(tuples.length, 13);
  let off = PAGE_HEADER;
  for (const tuple of tuples) {
    tuple.copy(page, off);
    off += tuple.length;
  }
  return page;
}

export function unpackPage(page: Buffer, columns: Column[]): Row[] {
  if (page.length !== PAGE_BYTES) {
    throw new Error(`page must be ${PAGE_BYTES} bytes`);
  }
  if (page.slice(0, 4).toString("ascii") !== "SLAB") {
    throw new Error("page magic is not SLAB");
  }
  const n = page.readUInt16LE(13);
  const rows: Row[] = [];
  let off = PAGE_HEADER;
  for (let i = 0; i < n; i++) {
    const row: Row = {};
    for (const col of columns) {
      const decoded = decodeValue(page, off, col.typ);
      row[col.name] = decoded.value;
      off = decoded.next;
    }
    rows.push(row);
  }
  return rows;
}

export function usedBytes(page: Buffer, columns: Column[]): number {
  const rows = unpackPage(page, columns);
  let used = PAGE_HEADER;
  for (const row of rows) {
    used += encodeTuple(columns, row).length;
  }
  return used;
}

export function tupleFitsWithColumns(
  page: Buffer,
  columns: Column[],
  tuple: Buffer
): boolean {
  return usedBytes(page, columns) + tuple.length <= PAGE_BYTES;
}

export function appendTuple(
  page: Buffer,
  columns: Column[],
  tuple: Buffer
): Buffer {
  const rows = unpackPage(page, columns);
  const packed = rows.map((row) => encodeTuple(columns, row));
  packed.push(tuple);
  const relOid = page.readUInt32LE(5);
  const pageNo = page.readUInt32LE(9);
  return packPage(relOid, pageNo, packed);
}
