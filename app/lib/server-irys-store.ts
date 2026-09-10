import { homedir } from "node:os";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  PAGE_BYTES,
  PageCache,
  UnreadablePageError,
  encodeIrysTxid,
  isLegacyLocalPageId,
  isIrysUnpaid,
  sha256,
  type IrysFunder,
  type PageStore,
  type UploadedPage,
} from "slabdb";
import { IRYS_GATEWAY, IRYS_RPC_URL } from "@/lib/cluster";

let irysHold: Promise<IrysFunder> | null = null;

function loadSecretKey(): Uint8Array {
  const raw = process.env.IRYS_SECRET_KEY?.trim();
  if (raw) {
    if (raw.startsWith("[")) {
      return Uint8Array.from(JSON.parse(raw) as number[]);
    }
    throw new Error("IRYS_SECRET_KEY must be a JSON byte array");
  }
  const path =
    process.env.ANCHOR_WALLET || join(homedir(), ".config/solana/id.json");
  const parsed = JSON.parse(readFileSync(path, "utf8")) as number[];
  return Uint8Array.from(parsed);
}

function gatewayUrl(id: string): string {
  return `${IRYS_GATEWAY.replace(/\/$/, "")}/${id}`;
}

async function irysClient(): Promise<IrysFunder> {
  if (irysHold) {
    return irysHold;
  }
  irysHold = (async () => {
    const { Uploader } = await import("@irys/upload");
    const { Solana } = await import("@irys/upload-solana");
    return (await Uploader(Solana)
      .withWallet(loadSecretKey())
      .withRpc(process.env.IRYS_RPC_URL || IRYS_RPC_URL)
      .withTokenOptions({ finality: "confirmed" })
      .devnet()) as unknown as IrysFunder;
  })();
  return irysHold;
}

export function irysStoreReady(): boolean {
  try {
    loadSecretKey();
    return true;
  } catch {
    return false;
  }
}

export class ServerIrysStore implements PageStore {
  private readonly cache: PageCache;

  constructor() {
    this.cache = new PageCache();
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
      throw new Error(
        `Irys page ${id} is ${page.length} bytes, want ${PAGE_BYTES}`
      );
    }
    this.cache.remember(id, page);
    return page;
  }
}
