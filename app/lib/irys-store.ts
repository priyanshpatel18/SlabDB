import {
  encodeIrysTxid,
  fundTxIdFromError,
  sendIrysFund,
  sha256,
  withTimeout,
  PAGE_BYTES,
  PageCache,
  type IrysFunder,
  type PageStore,
  type UploadedPage,
} from "slabdb";
import { IRYS_GATEWAY, IRYS_RPC_URL } from "@/lib/cluster";
import type { SlabSigner } from "@/lib/wallet";

const PENDING_FUND_KEY = "slab-irys-fund-txid";
const PAGE_KEY = "slab-page:";
const LOCAL_PAGE_ID = /^[0-9a-f]{64}$/;
const PAGE_TAGS = [
  { name: "Content-Type", value: "application/octet-stream" },
  { name: "App-Name", value: "Slab" },
];

export type StatusFn = (msg: string) => void;

function gatewayUrl(id: string): string {
  return `${IRYS_GATEWAY.replace(/\/$/, "")}/${id}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function unpaid(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /402|not enough funds|not enough balance/i.test(msg);
}

function readPendingFund(): string | null {
  try {
    return sessionStorage.getItem(PENDING_FUND_KEY);
  } catch {
    return null;
  }
}

function writePendingFund(txid: string | null): void {
  try {
    if (txid) {
      sessionStorage.setItem(PENDING_FUND_KEY, txid);
    } else {
      sessionStorage.removeItem(PENDING_FUND_KEY);
    }
  } catch {
    /* ignore */
  }
}

const cache = new PageCache();
let irysHold:
  | { key: string; client: Promise<IrysFunder> }
  | null = null;

function persistPage(id: string, page: Buffer): void {
  cache.remember(id, page);
  try {
    sessionStorage.setItem(PAGE_KEY + id, page.toString("base64"));
  } catch {
    /* quota */
  }
}

function recallPage(id: string): Buffer | undefined {
  const hit = cache.recall(id);
  if (hit) {
    return hit;
  }
  try {
    const raw = sessionStorage.getItem(PAGE_KEY + id);
    if (!raw) {
      return undefined;
    }
    const page = Buffer.from(raw, "base64");
    if (page.length !== PAGE_BYTES) {
      return undefined;
    }
    cache.remember(id, page);
    return page;
  } catch {
    return undefined;
  }
}

async function irysClient(wallet: SlabSigner): Promise<IrysFunder> {
  const key = wallet.publicKey.toBase58();
  if (irysHold?.key === key) {
    return irysHold.client;
  }
  const client = (async () => {
    const { WebUploader } = await import("@irys/web-upload");
    const { WebSolana } = await import("@irys/web-upload-solana");
    return (await WebUploader(WebSolana)
      .withProvider(wallet as never)
      .withRpc(IRYS_RPC_URL)
      .withTokenOptions({ finality: "confirmed" })
      .timeout(60_000)
      .devnet()) as unknown as IrysFunder;
  })();
  irysHold = { key, client };
  return withTimeout(client, 12_000, "Irys client");
}

async function waitForGateway(
  id: string,
  page: Buffer,
  onStatus: StatusFn
): Promise<void> {
  const url = gatewayUrl(id);
  for (let i = 1; i <= 20; i++) {
    onStatus(`Waiting for Irys gateway (${i})`);
    try {
      const res = await withTimeout(fetch(url), 8_000, "Irys GET");
      if (res.ok) {
        const got = Buffer.from(await res.arrayBuffer());
        if (got.length === page.length && got.equals(page)) {
          return;
        }
      }
    } catch {
      /* retry */
    }
    await sleep(1_500);
  }
  throw new Error(`Irys gateway did not return page ${id.slice(0, 8)}`);
}

export async function fundIrys(
  wallet: SlabSigner,
  onStatus: StatusFn = () => {}
): Promise<void> {
  onStatus("Connecting to Irys");
  const irys = await irysClient(wallet);
  try {
    await sendIrysFund({
      irys,
      wallet: {
        publicKey: wallet.publicKey,
        signTransaction: async (tx) => {
          const signed = await wallet.signTransaction(tx);
          return signed as typeof tx;
        },
      },
      rpcUrl: IRYS_RPC_URL,
      pendingTxid: readPendingFund(),
      onStatus,
      onSent: writePendingFund,
    });
    writePendingFund(null);
  } catch (err) {
    writePendingFund(fundTxIdFromError(err) ?? readPendingFund());
    throw err;
  }
}

async function uploadPage(
  irys: IrysFunder,
  page: Buffer
): Promise<{ id?: string }> {
  return irys.upload(page, { tags: PAGE_TAGS });
}

/** Interactive SQL uploads 8 KiB pages to Irys so other tabs can GET them. */
export class BrowserIrysPageStore implements PageStore {
  onStatus: StatusFn = () => {};

  constructor(private readonly wallet: SlabSigner) {}

  private status(msg: string): void {
    this.onStatus(msg);
  }

  async put(page: Buffer): Promise<UploadedPage> {
    if (page.length !== PAGE_BYTES) {
      throw new Error(`page must be ${PAGE_BYTES} bytes`);
    }
    const hash = sha256(page);
    this.status("Uploading page to Irys");
    const irys = await irysClient(this.wallet);
    let receipt: { id?: string };
    try {
      receipt = await uploadPage(irys, page);
    } catch (err) {
      if (!unpaid(err)) {
        throw err;
      }
      this.status("Funding Irys");
      await fundIrys(this.wallet, (msg) => this.status(msg));
      receipt = await uploadPage(irys, page);
    }
    if (!receipt?.id) {
      throw new Error("Irys upload returned no id");
    }
    await waitForGateway(receipt.id, page, (msg) => this.status(msg));
    persistPage(receipt.id, page);
    return {
      id: receipt.id,
      txid: encodeIrysTxid(receipt.id),
      hash,
    };
  }

  async get(id: string): Promise<Buffer> {
    const hit = recallPage(id);
    if (hit) {
      return hit;
    }
    this.status("Fetching Irys page");
    const url = gatewayUrl(id);
    const res = await withTimeout(fetch(url), 8_000, "Irys GET");
    if (!res.ok) {
      if (LOCAL_PAGE_ID.test(id)) {
        throw new Error(
          `Page ${id.slice(0, 8)} was stored only in another tab. New INSERT uploads to Irys.`
        );
      }
      throw new Error(
        `Page ${id.slice(0, 8)} is not in this tab and Irys GET failed (${res.status})`
      );
    }
    const page = Buffer.from(await res.arrayBuffer());
    if (page.length !== PAGE_BYTES) {
      throw new Error(
        `Irys page ${id} is ${page.length} bytes, want ${PAGE_BYTES}`
      );
    }
    persistPage(id, page);
    return page;
  }
}
