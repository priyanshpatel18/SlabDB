import { createHash } from "crypto";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

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

export const PAGE_BYTES = 8192;
export const DEFAULT_DEVNET_RPC = "https://rpc.magicblock.app/devnet";

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

const IRYS_TXID_RE = /^[A-Za-z0-9_-]{32,64}$/;
export const TXID_LEN = 64;

export function encodeIrysTxid(id: string): number[] {
  if (!IRYS_TXID_RE.test(id)) {
    throw new Error(
      `Irys id must be 32-64 URL-safe ASCII bytes, got ${JSON.stringify(id)}`
    );
  }
  const buf = Buffer.alloc(TXID_LEN);
  Buffer.from(id, "ascii").copy(buf);
  return Array.from(buf);
}

export function decodeIrysTxid(bytes: ArrayLike<number>): string {
  return Buffer.from(Array.from(bytes)).toString("ascii").replace(/\0+$/, "");
}

/** Offline stand-in. Live tests replace this with an Irys receipt id. */
export function fixtureTxid(): number[] {
  return encodeIrysTxid("a".repeat(43));
}

export function buildPage(relOid: number, pageNo: number, tuples: Buffer[]): Buffer {
  const page = Buffer.alloc(PAGE_BYTES);
  Buffer.from("SLAB").copy(page, 0);
  page.writeUInt8(1, 4);
  page.writeUInt32LE(relOid, 5);
  page.writeUInt32LE(pageNo, 9);
  page.writeUInt16LE(tuples.length, 13);
  let off = 32;
  for (const tuple of tuples) {
    tuple.copy(page, off);
    off += tuple.length;
  }
  return page;
}

export function noteTuple(id: bigint, author: string, body: string): Buffer {
  const buf = Buffer.alloc(8 + 2 + 32 + 2 + 64);
  buf.writeBigInt64LE(id, 0);
  buf.writeUInt16LE(author.length, 8);
  Buffer.from(author).copy(buf, 10);
  buf.writeUInt16LE(body.length, 42);
  Buffer.from(body).copy(buf, 44);
  return buf;
}

export function sha256(data: Buffer): number[] {
  return Array.from(createHash("sha256").update(data).digest());
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
