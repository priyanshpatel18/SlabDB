import { readFileSync } from "fs";
import { homedir } from "os";
import { encodeIrysTxid } from "./ids";
import { sha256 } from "./page";
import { PAGE_BYTES } from "./types";

export type UploadedPage = {
  id: string;
  txid: number[];
  hash: number[];
};

export interface PageStore {
  put(page: Buffer): Promise<UploadedPage>;
  get(id: string): Promise<Buffer>;
}

export class MemoryPageStore implements PageStore {
  private readonly pages = new Map<string, Buffer>();

  async put(page: Buffer): Promise<UploadedPage> {
    if (page.length !== PAGE_BYTES) {
      throw new Error(`page must be ${PAGE_BYTES} bytes`);
    }
    const hash = sha256(page);
    const id = Buffer.from(hash).toString("hex");
    this.pages.set(id, Buffer.from(page));
    return { id, txid: encodeIrysTxid(id), hash };
  }

  async get(id: string): Promise<Buffer> {
    const page = this.pages.get(id);
    if (!page) {
      throw new Error(`memory page store has no id ${id}`);
    }
    return Buffer.from(page);
  }
}

const DEFAULT_GATEWAY = "https://devnet.irys.xyz";
const DEFAULT_DEVNET_RPC = "https://rpc.magicblock.app/devnet";

function loadSecretKey(): Uint8Array {
  const path =
    process.env.ANCHOR_WALLET || `${homedir()}/.config/solana/id.json`;
  const parsed = JSON.parse(readFileSync(path, "utf8")) as number[];
  return Uint8Array.from(parsed);
}

function gatewayUrl(id: string): string {
  const base = (process.env.IRYS_GATEWAY || DEFAULT_GATEWAY).replace(/\/$/, "");
  return `${base}/${id}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class IrysPageStore implements PageStore {
  async put(page: Buffer): Promise<UploadedPage> {
    if (page.length !== PAGE_BYTES) {
      throw new Error(`page must be ${PAGE_BYTES} bytes`);
    }
    const { Uploader } = await import("@irys/upload");
    const { Solana } = await import("@irys/upload-solana");
    const rpc =
      process.env.IRYS_RPC_URL ||
      process.env.SLAB_BASE_RPC_URL ||
      DEFAULT_DEVNET_RPC;
    const irys = await Uploader(Solana)
      .withWallet(loadSecretKey())
      .withRpc(rpc)
      .devnet();
    const price = await irys.getPrice(page.length);
    const loaded = await irys.getLoadedBalance();
    if (BigInt(loaded.toString()) < BigInt(price.toString())) {
      await irys.fund(price);
    }
    const receipt = await irys.upload(page, {
      tags: [
        { name: "Content-Type", value: "application/octet-stream" },
        { name: "App-Name", value: "Slab" },
      ],
    });
    if (!receipt?.id) {
      throw new Error("Irys upload returned no id");
    }
    if (typeof receipt.verify === "function") {
      const ok = await receipt.verify();
      if (!ok) {
        throw new Error(`Irys receipt verify failed for ${receipt.id}`);
      }
    }
    const url = gatewayUrl(receipt.id);
    for (let i = 0; i < 30; i++) {
      const res = await fetch(url);
      if (res.ok) {
        const got = Buffer.from(await res.arrayBuffer());
        if (got.equals(page)) {
          return {
            id: receipt.id,
            txid: encodeIrysTxid(receipt.id),
            hash: sha256(page),
          };
        }
      }
      await sleep(2000);
    }
    throw new Error(`Irys gateway did not return page ${receipt.id}`);
  }

  async get(id: string): Promise<Buffer> {
    const url = gatewayUrl(id);
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Irys GET ${url} failed: ${res.status}`);
    }
    const page = Buffer.from(await res.arrayBuffer());
    if (page.length !== PAGE_BYTES) {
      throw new Error(`Irys page ${id} is ${page.length} bytes, want ${PAGE_BYTES}`);
    }
    return page;
  }
}
