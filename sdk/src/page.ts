// @ts-nocheck
import { sha256 as nobleSha256 } from "@noble/hashes/sha2.js";
import {
  readF64LE,
  readI32LE,
  readI64LE,
  readU16LE,
  readU32LE,
  readU8,
  writeF64LE,
  writeI32LE,
  writeI64LE,
  writeU16LE,
  writeU32LE,
  writeU8,
} from "./bytes";
import {
  COL_BOOL,
  COL_BYTEA,
  COL_FLOAT8,
  COL_INT4,
  COL_INT8,
  COL_JSON,
  COL_TEXT,
  COL_TIMESTAMPTZ,
  COL_UUID,
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
  return Array.from(nobleSha256(data));
}

export function sha256Hex(data: Buffer): string {
  return Buffer.from(nobleSha256(data)).toString("hex");
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
    case COL_UUID:
      return "uuid";
    case COL_FLOAT8:
      return "float8";
    case COL_JSON:
      return "json";
    case COL_BYTEA:
      return "bytea";
    default:
      throw new Error(`unknown column type ${typ}`);
  }
}

export function colTypeToAnchor(typ: ColTypeName): Record<string, Record<string, never>> {
  return { [typ]: {} };
}

/** Store timestamptz as Unix milliseconds in int64. Accept ISO-8601 or epoch seconds/ms. */
export function timestamptzMillis(value: SqlValue): bigint {
  if (
    typeof value === "boolean" ||
    value instanceof Uint8Array ||
    (typeof value === "object" && value !== null)
  ) {
    throw new Error("cannot convert value to timestamptz");
  }
  if (typeof value === "bigint" || typeof value === "number") {
    if (typeof value === "number" && !Number.isFinite(value)) {
      throw new Error("timestamptz is not a finite number");
    }
    return normalizeTsMillis(BigInt(value));
  }
  const raw = String(value).trim();
  if (/^-?\d+$/.test(raw)) {
    return normalizeTsMillis(BigInt(raw));
  }
  const ms = Date.parse(raw);
  if (Number.isNaN(ms)) {
    throw new Error(`cannot parse timestamptz ${JSON.stringify(value)}`);
  }
  return BigInt(ms);
}

function normalizeTsMillis(n: bigint): bigint {
  const abs = n < 0n ? -n : n;
  if (abs > 1_000_000_000_000_000n) {
    return n / 1000n;
  }
  if (abs < 100_000_000_000n) {
    return n * 1000n;
  }
  return n;
}

function timestamptzIso(ms: bigint): string {
  return new Date(Number(ms)).toISOString();
}

function parseUuid(value: SqlValue): Buffer {
  if (value instanceof Uint8Array) {
    if (value.length !== 16) {
      throw new Error("uuid must be 16 bytes");
    }
    return Buffer.from(value);
  }
  const hex = String(value).trim().toLowerCase().replace(/-/g, "");
  if (!/^[0-9a-f]{32}$/.test(hex)) {
    throw new Error(`cannot parse uuid ${JSON.stringify(value)}`);
  }
  return Buffer.from(hex, "hex");
}

function formatUuid(buf: Buffer): string {
  const h = buf.toString("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

function encodeVarlen(body: Buffer, label: string): Buffer {
  if (body.length > TEXT_MAX_BYTES) {
    throw new Error(`${label} longer than ${TEXT_MAX_BYTES} bytes`);
  }
  const buf = Buffer.alloc(2 + body.length);
  writeU16LE(buf, body.length, 0);
  body.copy(buf, 2);
  return buf;
}

function encodeJson(value: SqlValue): Buffer {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  try {
    JSON.parse(text);
  } catch {
    throw new Error("json value is not valid JSON");
  }
  return encodeVarlen(Buffer.from(text, "utf8"), "json");
}

function encodeBytea(value: SqlValue): Buffer {
  if (value instanceof Uint8Array) {
    return encodeVarlen(Buffer.from(value), "bytea");
  }
  const raw = String(value);
  if (/^\\x[0-9a-f]*$/i.test(raw)) {
    return encodeVarlen(Buffer.from(raw.slice(2), "hex"), "bytea");
  }
  return encodeVarlen(Buffer.from(raw, "utf8"), "bytea");
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
      writeU8(buf, value ? 1 : 0, 0);
      return buf;
    }
    case "int4": {
      const buf = Buffer.alloc(4);
      writeI32LE(buf, Number(value), 0);
      return buf;
    }
    case "int8": {
      const buf = Buffer.alloc(8);
      writeI64LE(buf, BigInt(value), 0);
      return buf;
    }
    case "text": {
      return encodeVarlen(Buffer.from(String(value), "utf8"), "text");
    }
    case "timestamptz": {
      const buf = Buffer.alloc(8);
      writeI64LE(buf, timestamptzMillis(value), 0);
      return buf;
    }
    case "uuid":
      return parseUuid(value);
    case "float8": {
      const buf = Buffer.alloc(8);
      const n = typeof value === "number" ? value : Number(value);
      if (!Number.isFinite(n)) {
        throw new Error("float8 is not a finite number");
      }
      writeF64LE(buf, n, 0);
      return buf;
    }
    case "json":
      return encodeJson(value);
    case "bytea":
      return encodeBytea(value);
    default:
      throw new Error(`unknown column type ${typ}`);
  }
}

export function decodeValue(buf: Buffer, off: number, typ: ColTypeName): { value: SqlValue; next: number } {
  switch (typ) {
    case "bool":
      return { value: readU8(buf, off) !== 0, next: off + 1 };
    case "int4":
      return { value: readI32LE(buf, off), next: off + 4 };
    case "int8":
      return { value: readI64LE(buf, off), next: off + 8 };
    case "text": {
      const len = readU16LE(buf, off);
      const start = off + 2;
      const value = buf.slice(start, start + len).toString("utf8");
      return { value, next: start + len };
    }
    case "timestamptz":
      return {
        value: timestamptzIso(readI64LE(buf, off)),
        next: off + 8,
      };
    case "uuid":
      return {
        value: formatUuid(buf.slice(off, off + 16)),
        next: off + 16,
      };
    case "float8":
      return { value: readF64LE(buf, off), next: off + 8 };
    case "json": {
      const len = readU16LE(buf, off);
      const start = off + 2;
      const text = buf.slice(start, start + len).toString("utf8");
      return { value: JSON.parse(text), next: start + len };
    }
    case "bytea": {
      const len = readU16LE(buf, off);
      const start = off + 2;
      return {
        value: new Uint8Array(buf.slice(start, start + len)),
        next: start + len,
      };
    }
    default:
      throw new Error(`unknown column type ${typ}`);
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
  writeU8(page, 2, 4);
  writeU32LE(page, relOid, 5);
  writeU32LE(page, pageNo, 9);
  writeU16LE(page, tuples.length, 13);
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
  const n = readU16LE(page, 13);
  const version = readU8(page, 4);
  const rows: PhysicalRow[] = [];
  let off = PAGE_HEADER;
  for (let i = 0; i < n; i++) {
    if (version >= 2) {
      const dead = readU8(page, off) === TUPLE_DEAD;
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
  return packPage(readU32LE(page, 5), readU32LE(page, 9), packed as Buffer[]);
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
  return packPage(readU32LE(page, 5), readU32LE(page, 9), packed as Buffer[]);
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
    page: packPage(readU32LE(page, 5), readU32LE(page, 9), packed as Buffer[]),
    slot: packed.length - 1,
  };
}

export function liveCount(page: Buffer, columns: Column[]): number {
  return unpackPhysical(page, columns).filter((r) => !r.dead).length;
}
