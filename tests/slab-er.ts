import * as anchor from "@anchor-lang/core";
import { Program } from "@anchor-lang/core";
import { expect } from "chai";
import {
  GetCommitmentSignature,
  MAGIC_CONTEXT_ID,
  MAGIC_PROGRAM_ID,
} from "@magicblock-labs/ephemeral-rollups-sdk";
import { Connection, PublicKey } from "@solana/web3.js";
import { Slab } from "../target/types/slab";
import {
  resolveErTarget,
  requireBaseRpc,
  requireFundedWallet,
  sendTx,
  waitDelegated,
  waitUndelegated,
  type Remaining,
} from "./er-helpers";
import {
  buildPage,
  decodeIrysTxid,
  int8Key,
  noteTuple,
  notesCreateTable,
  nsFrom,
  sha256,
  sleep,
  u32le,
} from "./helpers";

if (process.env.RUN_ER_TESTS !== "1") {
  describe.skip("slab public ER", () => {
    it("requires RUN_ER_TESTS=1", () => {});
  });
} else {
  describe("slab public ER", function () {
    this.timeout(1_000_000);

    const baseRpc = requireBaseRpc();
    const wallet = anchor.Wallet.local();
    const baseProvider = new anchor.AnchorProvider(
      new Connection(baseRpc, {
        wsEndpoint: process.env.WS_ENDPOINT || undefined,
        commitment: "confirmed",
      }),
      wallet,
      { commitment: "confirmed" }
    );

    const workspaceProgram = anchor.workspace.slab as Program<Slab>;
    const program = new Program<Slab>(workspaceProgram.idl, baseProvider);
    let erProvider: anchor.AnchorProvider;
    let programEr: Program<Slab>;
    let remainingAccounts: Remaining[] = [];

    const ns = nsFrom(`er-${Date.now().toString(36)}`);
    const relOid = 1;
    const pageNo = 0;
    const pkAttr = 0;

    const [slabPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("slab"), wallet.publicKey.toBuffer(), Buffer.from(ns)],
      program.programId
    );
    const [catalogPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("cat"), slabPda.toBuffer()],
      program.programId
    );
    const [feeVaultPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("fee"), wallet.publicKey.toBuffer(), Buffer.from(ns)],
      program.programId
    );
    const [pagePda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("page"),
        slabPda.toBuffer(),
        u32le(relOid),
        u32le(pageNo),
      ],
      program.programId
    );
    const [indexPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("idx"),
        slabPda.toBuffer(),
        u32le(relOid),
        Buffer.from([pkAttr]),
      ],
      program.programId
    );

    const page = buildPage(relOid, pageNo, [noteTuple(1n, "ada", "er note")]);
    const pk = int8Key(1n);
    let txid: number[] = [];
    let hash: number[] = [];
    let irysId = "";

    before(async () => {
      const info = await baseProvider.connection.getAccountInfo(
        program.programId
      );
      if (!info) {
        throw new Error(
          `Slab program ${program.programId.toBase58()} is not deployed on ${baseRpc}`
        );
      }

      const target = await resolveErTarget();
      remainingAccounts = target.remainingAccounts;
      erProvider = new anchor.AnchorProvider(
        new Connection(target.erUrl, {
          wsEndpoint: process.env.EPHEMERAL_WS_ENDPOINT || undefined,
          commitment: "confirmed",
        }),
        wallet,
        { commitment: "confirmed", skipPreflight: true }
      );
      programEr = new Program<Slab>(workspaceProgram.idl, erProvider);
      await requireFundedWallet(
        baseProvider.connection,
        wallet.publicKey,
        "base"
      );
      await requireFundedWallet(erProvider.connection, wallet.publicKey, "ER");
    });

    it("initialize + prepare_rel on base, then delegate", async () => {
      const initTx = await program.methods
        .initialize(ns)
        .accounts({
          authority: wallet.publicKey,
          slab: slabPda,
          catalog: catalogPda,
          feeVault: feeVaultPda,
        })
        .transaction();
      await sendTx(baseProvider.connection, initTx, wallet.payer, "initialize");

      const prepareTx = await program.methods
        .prepareRel(relOid, pageNo, pkAttr)
        .accounts({
          authority: wallet.publicKey,
          slab: slabPda,
          feeVault: feeVaultPda,
          index: indexPda,
          pagePtr: pagePda,
        })
        .transaction();
      await sendTx(baseProvider.connection, prepareTx, wallet.payer, "prepare_rel");

      const delegateTx = await program.methods
        .delegate(ns, relOid, pageNo, pkAttr)
        .accounts({
          payer: wallet.publicKey,
          slab: slabPda,
          catalog: catalogPda,
          index: indexPda,
          pagePtr: pagePda,
        })
        .remainingAccounts(remainingAccounts)
        .transaction();
      await sendTx(baseProvider.connection, delegateTx, wallet.payer, "delegate", {
        cuLimit: 400_000,
      });
      await waitDelegated(baseProvider.connection, slabPda, "slab");
      await waitDelegated(baseProvider.connection, catalogPda, "catalog");
      await waitDelegated(baseProvider.connection, indexPda, "index");
      await waitDelegated(baseProvider.connection, pagePda, "page_ptr");
      await sleep(3000);
    });

    it("CREATE TABLE on ER", async () => {
      const createTx = await programEr.methods
        .execSql(relOid, pkAttr, notesCreateTable)
        .accounts({
          authority: wallet.publicKey,
          slab: slabPda,
          catalog: catalogPda,
          index: indexPda,
        })
        .transaction();
      await sendTx(erProvider.connection, createTx, wallet.payer, "exec_sql", {
        cuLimit: 400_000,
      });

      const catalogInfo = await erProvider.connection.getAccountInfo(catalogPda);
      if (!catalogInfo) {
        throw new Error("catalog missing on ER after CREATE TABLE");
      }
      const catalog = program.coder.accounts.decode<{ nRels: number }>(
        "catalog",
        catalogInfo.data
      );
      expect(catalog.nRels).to.equal(1);
    });

    it("upload page to Irys, then INSERT on ER", async () => {
      const { uploadPage } = await import("./irys");
      const uploaded = await uploadPage(page);
      irysId = uploaded.id;
      txid = uploaded.txid;
      hash = uploaded.hash;

      const insertTx = await programEr.methods
        .execInsert(relOid, pageNo, pkAttr, "notes", txid, hash, [
          { key: pk.key, keyLen: pk.keyLen, slot: 0 },
        ])
        .accounts({
          authority: wallet.publicKey,
          slab: slabPda,
          catalog: catalogPda,
          pagePtr: pagePda,
          index: indexPda,
        })
        .transaction();
      await sendTx(erProvider.connection, insertTx, wallet.payer, "exec_insert", {
        cuLimit: 400_000,
      });

      const pageInfo = await erProvider.connection.getAccountInfo(pagePda);
      if (!pageInfo) {
        throw new Error("page_ptr missing on ER after INSERT");
      }
      const pagePtr = program.coder.accounts.decode<{
        txid: number[] | Uint8Array;
        nTuples: number;
      }>("pagePtr", pageInfo.data);
      expect(decodeIrysTxid(pagePtr.txid)).to.equal(irysId);
      expect(pagePtr.nTuples).to.equal(1);
    });

    it("SELECT on ER", async () => {
      const selectTx = await programEr.methods
        .execSelect(relOid, pkAttr, pk.key, pk.keyLen)
        .accounts({
          authority: wallet.publicKey,
          slab: slabPda,
          catalog: catalogPda,
          index: indexPda,
          pagePtr: pagePda,
        })
        .transaction();
      await sendTx(erProvider.connection, selectTx, wallet.payer, "exec_select");
    });

    it("prepare + delegate a second table after Slab is on the ER", async () => {
      const relOid2 = 2;
      const pkAttr2 = 0;
      const [index2] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("idx"),
          slabPda.toBuffer(),
          u32le(relOid2),
          Buffer.from([pkAttr2]),
        ],
        program.programId
      );
      const [page2] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("page"),
          slabPda.toBuffer(),
          u32le(relOid2),
          u32le(0),
        ],
        program.programId
      );

      const prepIdx = await program.methods
        .prepareIndex(relOid2, pkAttr2)
        .accounts({
          authority: wallet.publicKey,
          slab: slabPda,
          feeVault: feeVaultPda,
          index: index2,
        })
        .transaction();
      await sendTx(
        baseProvider.connection,
        prepIdx,
        wallet.payer,
        "prepare_index"
      );

      const prepPage = await program.methods
        .preparePage(relOid2, 0)
        .accounts({
          authority: wallet.publicKey,
          slab: slabPda,
          feeVault: feeVaultPda,
          pagePtr: page2,
        })
        .transaction();
      await sendTx(
        baseProvider.connection,
        prepPage,
        wallet.payer,
        "prepare_page"
      );

      const delIdx = await program.methods
        .delegateIndex(relOid2, pkAttr2)
        .accounts({
          payer: wallet.publicKey,
          slab: slabPda,
          index: index2,
        })
        .remainingAccounts(remainingAccounts)
        .transaction();
      await sendTx(
        baseProvider.connection,
        delIdx,
        wallet.payer,
        "delegate_index",
        { cuLimit: 400_000 }
      );
      await waitDelegated(baseProvider.connection, index2, "index2");

      const delPage = await program.methods
        .delegatePage(relOid2, 0)
        .accounts({
          payer: wallet.publicKey,
          slab: slabPda,
          pagePtr: page2,
        })
        .remainingAccounts(remainingAccounts)
        .transaction();
      await sendTx(
        baseProvider.connection,
        delPage,
        wallet.payer,
        "delegate_page",
        { cuLimit: 400_000 }
      );
      await waitDelegated(baseProvider.connection, page2, "page2");
      await sleep(3000);

      const createTx = await programEr.methods
        .execSql(relOid2, pkAttr2, {
          createTable: {
            name: "flags",
            columns: [
              { name: "ok", typ: { bool: {} }, notNull: true },
              { name: "n", typ: { int4: {} }, notNull: true },
              { name: "ts", typ: { timestamptz: {} }, notNull: true },
            ],
            pkAttr: 0,
          },
        })
        .accounts({
          authority: wallet.publicKey,
          slab: slabPda,
          catalog: catalogPda,
          index: index2,
        })
        .transaction();
      await sendTx(erProvider.connection, createTx, wallet.payer, "exec_sql flags", {
        cuLimit: 400_000,
      });

      const catalogInfo = await erProvider.connection.getAccountInfo(catalogPda);
      if (!catalogInfo) {
        throw new Error("catalog missing on ER after second CREATE TABLE");
      }
      const catalog = program.coder.accounts.decode<{ nRels: number }>(
        "catalog",
        catalogInfo.data
      );
      expect(catalog.nRels).to.equal(2);
    });

    it("commit until catalog_root shows on base", async () => {
      const erCatalog = await erProvider.connection.getAccountInfo(catalogPda);
      if (!erCatalog) {
        throw new Error("catalog missing on ER before commit");
      }
      const expectedRoot = sha256(Buffer.from(erCatalog.data));

      const commitTx = await programEr.methods
        .commit()
        .accounts({
          payer: wallet.publicKey,
          slab: slabPda,
          catalog: catalogPda,
          magicProgram: MAGIC_PROGRAM_ID,
          magicContext: MAGIC_CONTEXT_ID,
        })
        .transaction();
      const erSig = await sendTx(
        erProvider.connection,
        commitTx,
        wallet.payer,
        "commit"
      );
      await GetCommitmentSignature(erSig, erProvider.connection);

      let catalogRoot: number[] | null = null;
      let nRels = -1;
      for (let i = 0; i < 30; i++) {
        const slabInfo = await baseProvider.connection.getAccountInfo(slabPda);
        const catalogInfo = await baseProvider.connection.getAccountInfo(
          catalogPda
        );
        if (slabInfo && catalogInfo) {
          const slab = program.coder.accounts.decode<{
            catalogRoot: number[] | Uint8Array;
          }>("slabAccount", slabInfo.data);
          const catalog = program.coder.accounts.decode<{ nRels: number }>(
            "catalog",
            catalogInfo.data
          );
          catalogRoot = Array.from(slab.catalogRoot);
          nRels = catalog.nRels;
          if (catalogRoot.some((b) => b !== 0)) {
            break;
          }
        }
        await sleep(500);
      }

      expect(catalogRoot).to.deep.equal(expectedRoot);
      expect(nRels).to.equal(2);
    });

    it("undelegate then SELECT on base", async () => {
      const relOid2 = 2;
      const pkAttr2 = 0;
      const [index2] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("idx"),
          slabPda.toBuffer(),
          u32le(relOid2),
          Buffer.from([pkAttr2]),
        ],
        program.programId
      );
      const [page2] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("page"),
          slabPda.toBuffer(),
          u32le(relOid2),
          u32le(0),
        ],
        program.programId
      );
      const extra = [
        { pubkey: indexPda, isSigner: false, isWritable: true },
        { pubkey: pagePda, isSigner: false, isWritable: true },
        { pubkey: index2, isSigner: false, isWritable: true },
        { pubkey: page2, isSigner: false, isWritable: true },
      ];
      const undelegateTx = await programEr.methods
        .undelegate()
        .accounts({
          payer: wallet.publicKey,
          slab: slabPda,
          catalog: catalogPda,
          magicProgram: MAGIC_PROGRAM_ID,
          magicContext: MAGIC_CONTEXT_ID,
        })
        .remainingAccounts(extra)
        .transaction();
      const erSig = await sendTx(
        erProvider.connection,
        undelegateTx,
        wallet.payer,
        "undelegate",
        { cuLimit: 400_000 }
      );
      await GetCommitmentSignature(erSig, erProvider.connection);
      await waitUndelegated(
        baseProvider.connection,
        slabPda,
        "slab",
        program.programId
      );
      await waitUndelegated(
        baseProvider.connection,
        catalogPda,
        "catalog",
        program.programId
      );
      await waitUndelegated(
        baseProvider.connection,
        indexPda,
        "index",
        program.programId
      );
      await waitUndelegated(
        baseProvider.connection,
        pagePda,
        "page_ptr",
        program.programId
      );
      await sleep(2000);

      const selectTx = await program.methods
        .execSelect(relOid, pkAttr, pk.key, pk.keyLen)
        .accounts({
          authority: wallet.publicKey,
          slab: slabPda,
          catalog: catalogPda,
          index: indexPda,
          pagePtr: pagePda,
        })
        .transaction();
      await sendTx(
        baseProvider.connection,
        selectTx,
        wallet.payer,
        "exec_select base"
      );
    });
  });
}
