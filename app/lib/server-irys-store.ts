import {
  PAGE_BYTES,
  PageCache,
  UnreadablePageError,
  encodeIrysTxid,
  isLegacyLocalPageId,
  isIrysUnpaid,
  sendIrysFund,
  sha256,
  type IrysFunder,
  type PageStore,
  type SlabWallet,
  type UploadedPage,
} from "slabdb";
import { IRYS_GATEWAY, IRYS_RPC_URL } from "@/lib/cluster";

const PAGE_TAGS = [
  { name: "Content-Type", value: "application/octet-stream" },
  { name: "App-Name", value: "Slab" },
];

let irysHold: { key: string; client: Promise<IrysFunder> } | null = null;

function gatewayUrl(id: string): string {
  return `${IRYS_GATEWAY.replace(/\/$/, "")}/${id}`;
}

async function irysClient(wallet: SlabWallet): Promise<IrysFunder> {
  const key = wallet.publicKey.toBase58();
  if (irysHold?.key === key) {
    return irysHold.client;
  }
  const client = (async () => {
    const { WebUploader } = await import("@irys/web-upload");
    const { WebSolana } = await import("@irys/web-upload-solana");
    return (await WebUploader(WebSolana)
      .withProvider(wallet as never)
      .withRpc(process.env.IRYS_RPC_URL || IRYS_RPC_URL)
      .withTokenOptions({ finality: "confirmed" })
      .timeout(60_000)
      .devnet()) as unknown as IrysFunder;
  })();
  irysHold = { key, client };
  return client;
}

export class ServerIrysStore implements PageStore {
  private readonly cache: PageCache;

  constructor(private readonly wallet: SlabWallet) {
    this.cache = new PageCache();
  }

  async put(page: Buffer): Promise<UploadedPage> {
    if (page.length !== PAGE_BYTES) {
      throw new Error(`page must be ${PAGE_BYTES} bytes`);
    }
    const irys = await irysClient(this.wallet);
    let receipt: { id?: string };
    try {
      receipt = await irys.upload(page, { tags: PAGE_TAGS });
    } catch (err) {
      if (!isIrysUnpaid(err)) {
        throw err;
      }
      await sendIrysFund({
        irys,
        wallet: {
          publicKey: this.wallet.publicKey,
          signTransaction: async (tx) => {
            const signed = await this.wallet.signTransaction(tx);
            return signed as typeof tx;
          },
        },
        rpcUrl: process.env.IRYS_RPC_URL || IRYS_RPC_URL,
      });
      receipt = await irys.upload(page, { tags: PAGE_TAGS });
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
