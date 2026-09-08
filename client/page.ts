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
  TUPLE_DEAD,
  TUPLE_LIVE,
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

export function withLiveFlag(tuple: Buffer): Buffer {
  return Buffer.concat([Buffer.from([TUPLE_LIVE]), tuple]);
}

export function packPage(relOid: number, pageNo: number, tuples: Buffer[]): Buffer {
  const used = PAGE_HEADER + tuples.reduce((n, t) => n + t.length, 0);
  if (used > PAGE_BYTES) {
    throw new Error(`page overflow: ${used} > ${PAGE_BYTES}`);
  }
  const page = Buffer.alloc(PAGE_BYTES);
  Buffer.from("SLAB").copy(page, 0);
  page.writeUInt8(2, 4);
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

export type PhysicalRow = {
  dead: boolean;
  row: Row;
  start: number;
  length: number;
};

function tuplePayloadLen(page: Buffer, off: number, columns: Column[]): number {
  let cur = off + 1;
  for (const col of columns) {
    cur = decodeValue(page, cur, col.typ).next;
  }
  return cur - off;
}

export function unpackPhysical(page: Buffer, columns: Column[]): PhysicalRow[] {
  if (page.length !== PAGE_BYTES) {
    throw new Error(`page must be ${PAGE_BYTES} bytes`);
  }
  if (page.slice(0, 4).toString("ascii") !== "SLAB") {
    throw new Error("page magic is not SLAB");
  }
  const n = page.readUInt16LE(13);
  const version = page.readUInt8(4);
  const rows: PhysicalRow[] = [];
  let off = PAGE_HEADER;
  for (let i = 0; i < n; i++) {
    if (version >= 2) {
      const dead = page.readUInt8(off) === TUPLE_DEAD;
      const start = off;
      const length = tuplePayloadLen(page, off, columns);
      const row: Row = {};
      let cur = off + 1;
      for (const col of columns) {
        const decoded = decodeValue(page, cur, col.typ);
        row[col.name] = decoded.value;
        cur = decoded.next;
      }
      rows.push({ dead, row, start, length });
      off = start + length;
    } else {
      const start = off;
      const row: Row = {};
      for (const col of columns) {
        const decoded = decodeValue(page, off, col.typ);
        row[col.name] = decoded.value;
        off = decoded.next;
      }
      rows.push({ dead: false, row, start, length: off - start });
    }
  }
  return rows;
}

export function unpackPage(page: Buffer, columns: Column[]): Row[] {
  return unpackPhysical(page, columns)
    .filter((r) => !r.dead)
    .map((r) => r.row);
}

export function unpackSlot(
  page: Buffer,
  columns: Column[],
  slot: number
): Row | null {
  const rows = unpackPhysical(page, columns);
  if (slot < 0 || slot >= rows.length || rows[slot].dead) {
    return null;
  }
  return rows[slot].row;
}

export function usedBytes(page: Buffer, columns: Column[]): number {
  let used = PAGE_HEADER;
  for (const row of unpackPhysical(page, columns)) {
    used += row.length;
  }
  return used;
}

export function tupleFitsWithColumns(
  page: Buffer,
  columns: Column[],
  tuple: Buffer
): boolean {
  return usedBytes(page, columns) + withLiveFlag(tuple).length <= PAGE_BYTES;
}

export function appendTuple(
  page: Buffer,
  columns: Column[],
  tuple: Buffer
): Buffer {
  const packed = unpackPhysical(page, columns).map((r) =>
    Buffer.concat([
      Buffer.from([r.dead ? TUPLE_DEAD : TUPLE_LIVE]),
      encodeTuple(columns, r.row),
    ])
  );
  packed.push(withLiveFlag(tuple));
  return packPage(page.readUInt32LE(5), page.readUInt32LE(9), packed);
}

export function tombstoneSlot(
  page: Buffer,
  columns: Column[],
  slot: number
): Buffer {
  const rows = unpackPhysical(page, columns);
  if (slot < 0 || slot >= rows.length) {
    throw new Error("slot is out of range");
  }
  rows[slot].dead = true;
  const packed = rows.map((r) =>
    Buffer.concat([
      Buffer.from([r.dead ? TUPLE_DEAD : TUPLE_LIVE]),
      encodeTuple(columns, r.row),
    ])
  );
  return packPage(page.readUInt32LE(5), page.readUInt32LE(9), packed);
}

export function rewriteSlot(
  page: Buffer,
  columns: Column[],
  slot: number,
  tuple: Buffer
): { page: Buffer; slot: number } {
  const rows = unpackPhysical(page, columns);
  if (slot < 0 || slot >= rows.length) {
    throw new Error("slot is out of range");
  }
  const flagged = withLiveFlag(tuple);
  if (flagged.length === rows[slot].length) {
    const out = Buffer.from(page);
    flagged.copy(out, rows[slot].start);
    return { page: out, slot };
  }
  rows[slot].dead = true;
  const packed = rows.map((r) =>
    Buffer.concat([
      Buffer.from([r.dead ? TUPLE_DEAD : TUPLE_LIVE]),
      encodeTuple(columns, r.row),
    ])
  );
  packed.push(flagged);
  return {
    page: packPage(page.readUInt32LE(5), page.readUInt32LE(9), packed),
    slot: packed.length - 1,
  };
}

export function liveCount(page: Buffer, columns: Column[]): number {
  return unpackPhysical(page, columns).filter((r) => !r.dead).length;
}
