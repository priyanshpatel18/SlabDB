import { readU16LE, readU32LE, readU8 } from "./bytes";
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
  const nAttrs = readU8(buf, off + 12);
  const columns: Column[] = [];
  for (let a = 0; a < nAttrs; a++) {
    const aoff = off + 80 + a * 34;
    columns.push({
      name: cstr(buf.slice(aoff, aoff + 32)),
      typ: colTypeFromU8(readU8(buf, aoff + 32)),
      notNull: readU8(buf, aoff + 33) !== 0,
    });
  }
  return {
    oid: readU32LE(buf, off),
    nPages: readU32LE(buf, off + 4),
    nTuples: readU32LE(buf, off + 8),
    pkAttr: readU8(buf, off + 13),
    idxMask: readU16LE(buf, off + 14),
    name: cstr(buf.slice(off + 16, off + 80)),
    columns,
  };
}

export function decodeCatalog(data: Buffer): CatalogInfo {
  if (data.length < CATALOG_RELS_OFF) {
    throw new Error("catalog account is too small");
  }
  const nRels = readU16LE(data, 8);
  const flags = readU8(data, 11);
  const nextOid = readU32LE(data, 12);
  const capacity = Math.floor((data.length - CATALOG_RELS_OFF) / REL_SIZE);
  const rels: RelInfo[] = [];
  for (let i = 0; i < nRels; i++) {
    rels.push(decodeRel(data, CATALOG_RELS_OFF + i * REL_SIZE));
  }
  return { nRels, nextOid, flags, capacity, rels };
}
