import { readFileSync } from "fs";
import { homedir } from "os";
import { encodeIrysTxid } from "./ids";
import { type IrysFunder } from "./irys-fund";
import { sha256 } from "./page";
import { isLegacyLocalPageId, UnreadablePageError } from "./recovery";
import { PageCache, type PageStore, type UploadedPage } from "./store";
import { isIrysUnpaid } from "./timeout";
import { PAGE_BYTES } from "./types";

const DEFAULT_GATEWAY = "https://devnet.irys.xyz";
const IRYS_SOLANA_RPC = "https://api.devnet.solana.com";

let irysHold: Promise<IrysFunder> | null = null;

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

async function irysClient(): Promise<IrysFunder> {
  if (irysHold) {
    return irysHold;
  }
  irysHold = (async () => {
    const { Uploader } = await import("@irys/upload");
    const { Solana } = await import("@irys/upload-solana");
    const rpc = process.env.IRYS_RPC_URL || IRYS_SOLANA_RPC;
    return (await Uploader(Solana)
      .withWallet(loadSecretKey())
      .withRpc(rpc)
      .withTokenOptions({ finality: "confirmed" })
      .devnet()) as unknown as IrysFunder;
  })();
  return irysHold;
}

export type IrysPageStoreOpts = {
  /** Default is a private cache. Pass a shared cache only when one process owns both put and get. */
  cache?: PageCache;
};

export class IrysPageStore implements PageStore {
  private readonly cache: PageCache;

  constructor(opts: IrysPageStoreOpts = {}) {
    this.cache = opts.cache ?? new PageCache();
  }

  async put(page: Buffer): Promise<UploadedPage> {
    if (page.length !== PAGE_BYTES) {
      throw new Error(`page must be ${PAGE_BYTES} bytes`);
    }
    const irys = await irysClient();
    let receipt: { id?: string };
    try {
      receipt = await irys.upload(page, {
        tags: [
          { name: "Content-Type", value: "application/octet-stream" },
          { name: "App-Name", value: "Slab" },
        ],
      });
    } catch (err) {
      if (!isIrysUnpaid(err)) {
        throw err;
      }
      await irys.fund(irys.utils.toAtomic(0.05).toString(), 1.2);
      receipt = await irys.upload(page, {
        tags: [
          { name: "Content-Type", value: "application/octet-stream" },
          { name: "App-Name", value: "Slab" },
        ],
      });
    }
    if (!receipt?.id) {
      throw new Error("Irys upload returned no id");
    }
    this.cache.remember(receipt.id, page);
    return {
      id: receipt.id,
      txid: encodeIrysTxid(receipt.id),
      hash: sha256(page),
    };
  }

  async get(id: string): Promise<Buffer> {
    const hit = this.cache.recall(id);
    if (hit) {
      return hit;
    }
    const url = gatewayUrl(id);
    const res = await fetch(url);
    if (!res.ok) {
      if (isLegacyLocalPageId(id)) {
        throw new UnreadablePageError({ pageId: id });
      }
      throw new Error(`Irys GET ${url} failed: ${res.status}`);
    }
    const page = Buffer.from(await res.arrayBuffer());
    if (page.length !== PAGE_BYTES) {
      throw new Error(`Irys page ${id} is ${page.length} bytes, want ${PAGE_BYTES}`);
    }
    this.cache.remember(id, page);
    return page;
  }
}
