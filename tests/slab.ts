import * as anchor from "@anchor-lang/core";
import { Program } from "@anchor-lang/core";
import { expect } from "chai";
import { createHash } from "crypto";
import { Slab } from "../target/types/slab";

const PAGE_BYTES = 8192;

function u32le(n: number): Buffer {
  const buf = Buffer.alloc(4);
  buf.writeUInt32LE(n);
  return buf;
}

function nsFrom(label: string): number[] {
  const buf = Buffer.alloc(32);
  Buffer.from(label).copy(buf);
  return Array.from(buf);
}

function int8Key(value: bigint): { key: number[]; keyLen: number } {
  const key = Buffer.alloc(32);
  key.writeBigInt64LE(value, 0);
  return { key: Array.from(key), keyLen: 8 };
}

function fixtureTxid(): number[] {
  return Array.from(Buffer.alloc(43, 0x61));
}

function buildPage(relOid: number, pageNo: number, tuples: Buffer[]): Buffer {
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

function noteTuple(id: bigint, author: string, body: string): Buffer {
  const buf = Buffer.alloc(8 + 2 + 32 + 2 + 64);
  buf.writeBigInt64LE(id, 0);
  buf.writeUInt16LE(author.length, 8);
  Buffer.from(author).copy(buf, 10);
  buf.writeUInt16LE(body.length, 42);
  Buffer.from(body).copy(buf, 44);
  return buf;
}

describe("slab", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.slab as Program<Slab>;
  const ns = nsFrom("notes-demo");
  const relOid = 1;
  const pageNo = 0;
  const pkAttr = 0;

  const [slabPda] = anchor.web3.PublicKey.findProgramAddressSync(
    [
      Buffer.from("slab"),
      provider.wallet.publicKey.toBuffer(),
      Buffer.from(ns),
    ],
    program.programId
  );
  const [catalogPda] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("cat"), slabPda.toBuffer()],
    program.programId
  );
  const [pagePda] = anchor.web3.PublicKey.findProgramAddressSync(
    [
      Buffer.from("page"),
      slabPda.toBuffer(),
      u32le(relOid),
      u32le(pageNo),
    ],
    program.programId
  );
  const [indexPda] = anchor.web3.PublicKey.findProgramAddressSync(
    [
      Buffer.from("idx"),
      slabPda.toBuffer(),
      u32le(relOid),
      Buffer.from([pkAttr]),
    ],
    program.programId
  );

  const page = buildPage(relOid, pageNo, [
    noteTuple(1n, "ada", "first note"),
  ]);
  const hash = Array.from(createHash("sha256").update(page).digest());
  const txid = fixtureTxid();
  const pk = int8Key(1n);

  it("initialize + CREATE TABLE notes", async () => {
    await program.methods
      .initialize(ns)
      .accounts({
        authority: provider.wallet.publicKey,
        slab: slabPda,
        catalog: catalogPda,
      })
      .rpc();

    await program.methods
      .execSql(relOid, pkAttr, {
        createTable: {
          name: "notes",
          columns: [
            { name: "id", typ: { int8: {} }, notNull: true },
            { name: "author", typ: { text: {} }, notNull: true },
            { name: "body", typ: { text: {} }, notNull: true },
          ],
          pkAttr: 0,
        },
      })
      .accounts({
        authority: provider.wallet.publicKey,
        slab: slabPda,
        catalog: catalogPda,
        index: indexPda,
      })
      .rpc();

    const catalog = await program.account.catalog.fetch(catalogPda);
    const index = await program.account.index.fetch(indexPda);
    expect(catalog.nRels).to.equal(1);
    expect(catalog.rels[0].nAttrs).to.equal(3);
    expect(index.nKeys).to.equal(0);
    expect(index.relOid).to.equal(relOid);
  });

  it("INSERT writes PagePtr + Index, not row bytes", async () => {
    await program.methods
      .execInsert(relOid, pageNo, pkAttr, "notes", txid, hash, [
        { key: pk.key, keyLen: pk.keyLen, slot: 0 },
      ])
      .accounts({
        authority: provider.wallet.publicKey,
        slab: slabPda,
        catalog: catalogPda,
        pagePtr: pagePda,
        index: indexPda,
      })
      .rpc();

    const pagePtr = await program.account.pagePtr.fetch(pagePda);
    const index = await program.account.index.fetch(indexPda);
    const catalog = await program.account.catalog.fetch(catalogPda);
    expect(Array.from(pagePtr.hash)).to.deep.equal(hash);
    expect(pagePtr.nTuples).to.equal(1);
    expect(pagePtr.txid).to.have.length(43);
    expect(index.nKeys).to.equal(1);
    expect(catalog.rels[0].nPages).to.equal(1);
    expect(catalog.rels[0].nTuples).to.equal(1);
    expect(page.length).to.equal(PAGE_BYTES);
  });

  it("SELECT WHERE id = 1 hits the fixture pointer", async () => {
    await program.methods
      .execSelect(relOid, pkAttr, pk.key, pk.keyLen)
      .accounts({
        authority: provider.wallet.publicKey,
        slab: slabPda,
        catalog: catalogPda,
        index: indexPda,
        pagePtr: pagePda,
      })
      .rpc();

    const pagePtr = await program.account.pagePtr.fetch(pagePda);
    expect(Array.from(pagePtr.hash)).to.deep.equal(hash);
  });

  it("SELECT missing PK fails", async () => {
    const missing = int8Key(99n);
    try {
      await program.methods
        .execSelect(relOid, pkAttr, missing.key, missing.keyLen)
        .accounts({
          authority: provider.wallet.publicKey,
          slab: slabPda,
          catalog: catalogPda,
          index: indexPda,
          pagePtr: pagePda,
        })
        .rpc();
      expect.fail("missing PK must fail");
    } catch (err: unknown) {
      expect(String(err)).to.match(/RowNotFound|row not found/i);
    }
  });
});
