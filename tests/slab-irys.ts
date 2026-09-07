import * as anchor from "@anchor-lang/core";
import { Program } from "@anchor-lang/core";
import { expect } from "chai";
import { Slab } from "../target/types/slab";
import {
  PAGE_BYTES,
  buildPage,
  decodeIrysTxid,
  encodeIrysTxid,
  int8Key,
  noteTuple,
  notesCreateTable,
  nsFrom,
  sha256,
  u32le,
} from "./helpers";

if (process.env.RUN_IRYS_TESTS !== "1" || process.env.RUN_ER_TESTS === "1") {
  describe.skip("slab irys", () => {
    it("requires RUN_IRYS_TESTS=1", () => {});
  });
} else {
  describe("slab irys", function () {
    this.timeout(1_000_000);

    const provider = anchor.AnchorProvider.env();
    anchor.setProvider(provider);
    const program = anchor.workspace.slab as Program<Slab>;

    const ns = nsFrom(`irys-${Date.now().toString(36)}`);
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
      [
        Buffer.from("fee"),
        provider.wallet.publicKey.toBuffer(),
        Buffer.from(ns),
      ],
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
      noteTuple(1n, "ada", "irys note"),
    ]);
    const pk = int8Key(1n);
    let txid: number[] = [];
    let hash: number[] = [];
    let irysId = "";

    it("rejects a txid that is not an Irys id", async () => {
      expect(() => encodeIrysTxid("not-an-irys-id")).to.throw(/32-64 URL-safe/);
      expect(encodeIrysTxid("a".repeat(43))).to.have.length(64);
      expect(decodeIrysTxid(encodeIrysTxid("BNHEmDUXjS4QqHxALEHgs83rSCM8QYqqW5pt8AqJ7B9p"))).to.equal(
        "BNHEmDUXjS4QqHxALEHgs83rSCM8QYqqW5pt8AqJ7B9p"
      );
    });

    it("upload page to Irys, then INSERT the receipt id", async () => {
      const { uploadPage } = await import("./irys");
      const uploaded = await uploadPage(page);
      irysId = uploaded.id;
      txid = uploaded.txid;
      hash = uploaded.hash;
      expect(page.length).to.equal(PAGE_BYTES);
      expect(hash).to.deep.equal(sha256(page));
      expect(txid).to.deep.equal(encodeIrysTxid(irysId));

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
      expect(decodeIrysTxid(pagePtr.txid)).to.equal(irysId);
      expect(Array.from(pagePtr.hash)).to.deep.equal(hash);
      expect(pagePtr.nTuples).to.equal(1);
    });

    it("SELECT hits the Irys pointer, not row bytes", async function () {
      if (!irysId) {
        this.skip();
      }
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
      expect(decodeIrysTxid(pagePtr.txid)).to.equal(irysId);
    });
  });
}
