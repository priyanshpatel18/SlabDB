import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import { decodeIrysTxid, encodeIrysTxid, fixtureTxid } from "../client/ids";
import { encodeTuple, packPage, sha256 } from "../client/page";
import { PAGE_BYTES, type Column } from "../client/types";

function loadDotEnv() {
  const path = resolve(process.cwd(), ".env");
  if (!existsSync(path)) {
    return;
  }
  for (const raw of readFileSync(path, "utf8").split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }
    const eq = line.indexOf("=");
    if (eq <= 0) {
      continue;
    }
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadDotEnv();

export { PAGE_BYTES, decodeIrysTxid, encodeIrysTxid, fixtureTxid, sha256 };

export const DEFAULT_DEVNET_RPC = "https://rpc.magicblock.app/devnet";

const NOTES_COLS: Column[] = [
  { name: "id", typ: "int8", notNull: true },
  { name: "author", typ: "text", notNull: true },
  { name: "body", typ: "text", notNull: true },
];

export function u32le(n: number): Buffer {
  const buf = Buffer.alloc(4);
  buf.writeUInt32LE(n);
  return buf;
}

export function nsFrom(label: string): number[] {
  const buf = Buffer.alloc(32);
  Buffer.from(label).copy(buf);
  return Array.from(buf);
}

export function int8Key(value: bigint): { key: number[]; keyLen: number } {
  const key = Buffer.alloc(32);
  key.writeBigInt64LE(value, 0);
  return { key: Array.from(key), keyLen: 8 };
}

export function buildPage(relOid: number, pageNo: number, tuples: Buffer[]): Buffer {
  return packPage(relOid, pageNo, tuples);
}

export function noteTuple(id: bigint, author: string, body: string): Buffer {
  return encodeTuple(NOTES_COLS, { id, author, body });
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const notesCreateTable = {
  createTable: {
    name: "notes",
    columns: [
      { name: "id", typ: { int8: {} }, notNull: true },
      { name: "author", typ: { text: {} }, notNull: true },
      { name: "body", typ: { text: {} }, notNull: true },
    ],
    pkAttr: 0,
  },
};
