import { readFileSync } from "fs";
import { homedir } from "os";
import { PAGE_BYTES, encodeIrysTxid, sha256, sleep } from "./helpers";

const DEFAULT_GATEWAY = "https://devnet.irys.xyz";

export type UploadedPage = {
  id: string;
  txid: number[];
  hash: number[];
};

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

async function waitForGateway(id: string, page: Buffer): Promise<void> {
  const url = gatewayUrl(id);
  for (let i = 0; i < 30; i++) {
    const res = await fetch(url);
    if (res.ok) {
      const got = Buffer.from(await res.arrayBuffer());
      if (got.equals(page)) {
        return;
      }
    }
    await sleep(2000);
  }
  throw new Error(`Irys gateway did not return page ${id} from ${url}`);
}

/**
 * Pack is done by the caller. This uploads the 8 KiB page, waits for the
 * Irys receipt (and gateway bytes), then returns a zero-padded id for INSERT.
 */
export async function uploadPage(page: Buffer): Promise<UploadedPage> {
  if (page.length !== PAGE_BYTES) {
    throw new Error(`page must be ${PAGE_BYTES} bytes`);
  }

  const { Uploader } = await import("@irys/upload");
  const { Solana } = await import("@irys/upload-solana");

  const rpc = process.env.IRYS_RPC_URL || "https://api.devnet.solana.com";
  const irys = await Uploader(Solana)
    .withWallet(loadSecretKey())
    .withRpc(rpc)
    .withTokenOptions({ finality: "confirmed" })
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

  await waitForGateway(receipt.id, page);
  return {
    id: receipt.id,
    txid: encodeIrysTxid(receipt.id),
    hash: sha256(page),
  };
}
