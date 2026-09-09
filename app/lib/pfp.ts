"use client";

import { Buffer } from "buffer";
import { fundIrys, type StatusFn } from "slabdb/web";
import { IRYS_RPC_URL } from "@/lib/cluster";
import type { SlabSigner } from "@/lib/wallet";

function isIrysUnpaid(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /402|not enough funds|not enough balance/i.test(msg);
}

const MAX_EDGE = 512;
const JPEG_QUALITY = 0.86;

function coverDraw(
  ctx: CanvasRenderingContext2D,
  img: ImageBitmap,
  size: number
): void {
  const scale = Math.max(size / img.width, size / img.height);
  const w = img.width * scale;
  const h = img.height * scale;
  ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
}

async function fileToJpeg(file: File): Promise<Buffer> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = MAX_EDGE;
  canvas.height = MAX_EDGE;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    throw new Error("Could not read the photo");
  }
  coverDraw(ctx, bitmap, MAX_EDGE);
  bitmap.close();
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (next) => {
        if (next) {
          resolve(next);
        } else {
          reject(new Error("Could not encode the photo"));
        }
      },
      "image/jpeg",
      JPEG_QUALITY
    );
  });
  return Buffer.from(await blob.arrayBuffer());
}

async function irysUpload(
  wallet: SlabSigner,
  data: Buffer
): Promise<{ id?: string }> {
  const { WebUploader } = await import("@irys/web-upload");
  const { WebSolana } = await import("@irys/web-upload-solana");
  const irys = await WebUploader(WebSolana)
    .withProvider(wallet as never)
    .withRpc(IRYS_RPC_URL)
    .withTokenOptions({ finality: "confirmed" })
    .timeout(60_000)
    .devnet();
  return irys.upload(data, {
    tags: [
      { name: "Content-Type", value: "image/jpeg" },
      { name: "App-Name", value: "Slab" },
      { name: "App-File", value: "pfp" },
    ],
  });
}

export async function uploadPfp(
  wallet: SlabSigner,
  file: File,
  onStatus: StatusFn = () => {}
): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Choose an image file");
  }
  onStatus("Preparing photo");
  const jpeg = await fileToJpeg(file);
  onStatus("Uploading photo to Irys");
  let receipt: { id?: string };
  try {
    receipt = await irysUpload(wallet, jpeg);
  } catch (err) {
    if (!isIrysUnpaid(err)) {
      throw err;
    }
    onStatus("Funding Irys");
    await fundIrys(wallet, onStatus);
    receipt = await irysUpload(wallet, jpeg);
  }
  if (!receipt?.id) {
    throw new Error("Photo upload returned no id");
  }
  return receipt.id;
}
