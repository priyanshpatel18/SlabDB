import * as anchor from "@anchor-lang/core";
import { Program } from "@anchor-lang/core";
import { expect } from "chai";
import { Slab } from "../target/types/slab";
import {
  PAGE_BYTES,
  buildPage,
  decodeIrysTxid,
  fixtureTxid,
  int8Key,
  noteTuple,
  notesCreateTable,
  nsFrom,
  sha256,
  u32le,
} from "./helpers";

if (process.env.RUN_ER_TESTS === "1") {
  describe.skip("slab", () => {
    it("skipped when RUN_ER_TESTS=1", () => {});
  });
} else {
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
  const [feeVaultPda] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("fee"), provider.wallet.publicKey.toBuffer(), Buffer.from(ns)],
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

  const page = buildPage(relOid, pageNo, [noteTuple(1n, "ada", "first note")]);
  const hash = sha256(page);
  const txid = fixtureTxid();
  const pk = int8Key(1n);

  it("initialize + CREATE TABLE notes", async () => {
    await program.methods
      .initialize(ns)
      .accounts({
        authority: provider.wallet.publicKey,
        slab: slabPda,
        catalog: catalogPda,
        feeVault: feeVaultPda,
      })
      .rpc();

    await program.methods
      .execSql(relOid, pkAttr, notesCreateTable)
      .accounts({
        authority: provider.wallet.publicKey,
        slab: slabPda,
        catalog: catalogPda,
        feeVault: feeVaultPda,
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

  it("INSERT rejects a txid that is not an Irys id", async () => {
    const bad = Array.from(Buffer.alloc(64, 0));
    try {
      await program.methods
        .execInsert(relOid, pageNo, pkAttr, "notes", bad, hash, [
          { key: pk.key, keyLen: pk.keyLen, slot: 0 },
        ])
        .accounts({
          authority: provider.wallet.publicKey,
          slab: slabPda,
          catalog: catalogPda,
          feeVault: feeVaultPda,
          pagePtr: pagePda,
          index: indexPda,
        })
        .rpc();
      expect.fail("zero txid must fail");
    } catch (err: unknown) {
      expect(String(err)).to.match(/InvalidPointer|txid must be/i);
    }
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
        feeVault: feeVaultPda,
        pagePtr: pagePda,
        index: indexPda,
      })
      .rpc();

    const pagePtr = await program.account.pagePtr.fetch(pagePda);
    const index = await program.account.index.fetch(indexPda);
    const catalog = await program.account.catalog.fetch(catalogPda);
    expect(Array.from(pagePtr.hash)).to.deep.equal(hash);
    expect(pagePtr.nTuples).to.equal(1);
    expect(decodeIrysTxid(pagePtr.txid)).to.equal("a".repeat(43));
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
}
