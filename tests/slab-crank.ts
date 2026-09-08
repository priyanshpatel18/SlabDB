import * as anchor from "@anchor-lang/core";
import { BN, Program } from "@anchor-lang/core";
import { expect } from "chai";
import { Connection, PublicKey } from "@solana/web3.js";
import { Slab } from "../target/types/slab";
import {
  MAGIC_CONTEXT_ID,
  MAGIC_PROGRAM_ID,
  requireBaseRpc,
  requireFundedWallet,
  resolveErTarget,
  resolveMagicFeeVault,
  sendTx,
  waitDelegated,
  type Remaining,
} from "./er-helpers";
import {
  buildPage,
  fixtureTxid,
  int8Key,
  noteTuple,
  notesCreateTable,
  nsFrom,
  sha256,
  sleep,
  u32le,
} from "./helpers";

if (process.env.RUN_CRANK_TESTS !== "1") {
  describe.skip("slab commit crank", () => {
    it("requires RUN_CRANK_TESTS=1", () => {});
  });
} else {
  describe("slab commit crank", function () {
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
    let magicFeeVault: PublicKey;
    let delegationRecord: PublicKey;

    const ns = nsFrom(`crank-${Date.now().toString(36)}`);
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

    const page = buildPage(relOid, pageNo, [
      noteTuple(1n, "ada", "crank note"),
    ]);
    const hash = sha256(page);
    const txid = fixtureTxid();
    const pk = int8Key(1n);

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

    it("prepare on base, CREATE TABLE + INSERT on ER", async () => {
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
      await sleep(3000);

      const fees = await resolveMagicFeeVault(baseProvider.connection, slabPda);
      magicFeeVault = fees.vault;
      delegationRecord = fees.record;

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
    });

    it("crank_commit stamps catalog_root on ER and on base", async () => {
      const scheduleTx = await programEr.methods
        .scheduleCommitCrank({
          taskId: new BN(Date.now()),
          executionIntervalMillis: new BN(1000),
          iterations: new BN(3),
        })
        .accounts({
          magicProgram: MAGIC_PROGRAM_ID,
          payer: wallet.publicKey,
          slab: slabPda,
          catalog: catalogPda,
          delegationRecord,
          magicFeeVault,
          magicContext: MAGIC_CONTEXT_ID,
          program: program.programId,
        })
        .transaction();
      await sendTx(
        erProvider.connection,
        scheduleTx,
        wallet.payer,
        "schedule_commit_crank"
      );

      const erCatalog = await erProvider.connection.getAccountInfo(catalogPda);
      if (!erCatalog) {
        throw new Error("catalog missing on ER after schedule");
      }
      const expectedRoot = sha256(Buffer.from(erCatalog.data));

      let erRoot: number[] | null = null;
      for (let i = 0; i < 40; i++) {
        const slabInfo = await erProvider.connection.getAccountInfo(slabPda);
        if (slabInfo) {
          const slab = program.coder.accounts.decode<{
            catalogRoot: number[] | Uint8Array;
          }>("slabAccount", slabInfo.data);
          erRoot = Array.from(slab.catalogRoot);
          if (erRoot.some((b) => b !== 0)) {
            break;
          }
        }
        await sleep(500);
      }
      expect(erRoot, "crank did not stamp catalog_root on ER").to.not.equal(
        null
      );
      expect(erRoot!.some((b) => b !== 0)).to.equal(true);
      expect(erRoot).to.deep.equal(expectedRoot);

      let baseRoot: number[] | null = null;
      for (let i = 0; i < 60; i++) {
        const slabInfo = await baseProvider.connection.getAccountInfo(slabPda);
        if (slabInfo) {
          const slab = program.coder.accounts.decode<{
            catalogRoot: number[] | Uint8Array;
          }>("slabAccount", slabInfo.data);
          baseRoot = Array.from(slab.catalogRoot);
          if (baseRoot.some((b) => b !== 0)) {
            break;
          }
        }
        await sleep(500);
      }
      expect(baseRoot, "crank did not commit catalog_root to base").to.not.equal(
        null
      );
      expect(baseRoot).to.deep.equal(expectedRoot);
    });
  });
}
