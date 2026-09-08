import { colTypeFromU8 } from "./page";
import type { Column } from "./types";

export const REL_SIZE = 624;
export const CATALOG_RELS_OFF = 16;

export type RelInfo = {
  oid: number;
  name: string;
  pkAttr: number;
  idxMask: number;
  nPages: number;
  nTuples: number;
  columns: Column[];
};

export type CatalogInfo = {
  nRels: number;
  nextOid: number;
  flags: number;
  capacity: number;
  rels: RelInfo[];
};

function cstr(bytes: Buffer): string {
  const end = bytes.indexOf(0);
  return bytes.slice(0, end < 0 ? bytes.length : end).toString("utf8");
}

function decodeRel(buf: Buffer, off: number): RelInfo {
  const nAttrs = buf.readUInt8(off + 12);
  const columns: Column[] = [];
  for (let a = 0; a < nAttrs; a++) {
    const aoff = off + 80 + a * 34;
    columns.push({
      name: cstr(buf.slice(aoff, aoff + 32)),
      typ: colTypeFromU8(buf.readUInt8(aoff + 32)),
      notNull: buf.readUInt8(aoff + 33) !== 0,
    });
  }
  return {
    oid: buf.readUInt32LE(off),
    nPages: buf.readUInt32LE(off + 4),
    nTuples: buf.readUInt32LE(off + 8),
    pkAttr: buf.readUInt8(off + 13),
    idxMask: buf.readUInt16LE(off + 14),
    name: cstr(buf.slice(off + 16, off + 80)),
    columns,
  };
}

export function decodeCatalog(data: Buffer): CatalogInfo {
  if (data.length < CATALOG_RELS_OFF) {
    throw new Error("catalog account is too small");
  }
  const nRels = data.readUInt16LE(8);
  const flags = data.readUInt8(11);
  const nextOid = data.readUInt32LE(12);
  const capacity = Math.floor((data.length - CATALOG_RELS_OFF) / REL_SIZE);
  const rels: RelInfo[] = [];
  for (let i = 0; i < nRels; i++) {
    rels.push(decodeRel(data, CATALOG_RELS_OFF + i * REL_SIZE));
  }
  return { nRels, nextOid, flags, capacity, rels };
}
