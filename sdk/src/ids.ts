import { PAGE_BYTES, TXID_LEN, TXID_MIN_LEN } from "./types";

const IRYS_TXID_RE = /^[A-Za-z0-9_-]{32,64}$/;

export { PAGE_BYTES };

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

export function fixtureTxid(): number[] {
  return encodeIrysTxid("a".repeat(TXID_MIN_LEN + 11));
}
