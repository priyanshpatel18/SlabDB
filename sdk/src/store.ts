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

/** In-process page bytes. Avoid a gateway round trip on the next GET. */
export class PageCache {
  private readonly pages = new Map<string, Buffer>();

  remember(id: string, page: Buffer): void {
    this.pages.set(id, Buffer.from(page));
  }

  recall(id: string): Buffer | undefined {
    const page = this.pages.get(id);
    return page ? Buffer.from(page) : undefined;
  }
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
