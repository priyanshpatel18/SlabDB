import * as anchor from "@anchor-lang/core";
import { Program } from "@anchor-lang/core";
import { expect } from "chai";
import {
  GetCommitmentSignature,
} from "@magicblock-labs/ephemeral-rollups-sdk";
import { Connection } from "@solana/web3.js";
import { Slab } from "../target/types/slab";
import { IrysPageStore, SlabDb } from "../client";
import {
  resolveErTarget,
  requireBaseRpc,
  requireFundedWallet,
  waitDelegated,
  waitUndelegated,
  type Remaining,
} from "./er-helpers";
import { nsFrom, sleep } from "./helpers";

if (process.env.RUN_ER_TESTS !== "1") {
  describe.skip("slab db public ER", () => {
    it("requires RUN_ER_TESTS=1", () => {});
  });
} else {
  describe("slab db public ER", function () {
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
    let db: SlabDb;

    const ns = nsFrom(`dber-${Date.now().toString(36)}`);
    const store = new IrysPageStore();

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
      db = new SlabDb({
        program,
        programEr,
        wallet: wallet.publicKey,
        ns,
        store,
        remainingAccounts,
      });
      await requireFundedWallet(
        baseProvider.connection,
        wallet.publicKey,
        "base"
      );
      await requireFundedWallet(erProvider.connection, wallet.publicKey, "ER");
    });

    it("CREATE TABLE on base, then delegate", async () => {
      await db.exec(
        "CREATE TABLE notes (id int8 PRIMARY KEY, author text NOT NULL, body text NOT NULL)"
      );
      await db.delegate(1, 0, 0);
      await waitDelegated(baseProvider.connection, db.slabPda, "slab");
      await waitDelegated(baseProvider.connection, db.catalogPda, "catalog");
      await sleep(2000);
    });

    it("INSERT and SELECT on the ER with IrysPageStore", async () => {
      await db.exec(
        "INSERT INTO notes (id, author, body) VALUES (1, 'ada', 'er db note')"
      );
      const rows = await db.exec("SELECT * FROM notes WHERE id = 1");
      expect(rows).to.have.length(1);
      expect(rows[0].author).to.equal("ada");
      expect(rows[0].body).to.equal("er db note");
    });

    it("UPDATE on the ER then SELECT", async () => {
      await db.exec("UPDATE notes SET body = 'er edited' WHERE id = 1");
      const rows = await db.exec("SELECT * FROM notes WHERE id = 1");
      expect(rows).to.have.length(1);
      expect(rows[0].body).to.equal("er edited");
    });

    it("undelegate then SELECT on base", async () => {
      const extra = db.extraCommitAccounts({
        oid: 1,
        name: "notes",
        pkAttr: 0,
        idxMask: 1,
        nPages: 1,
        nTuples: 1,
        columns: [
          { name: "id", typ: "int8", notNull: true },
          { name: "author", typ: "text", notNull: true },
          { name: "body", typ: "text", notNull: true },
        ],
      });
      const commitSig = await db.commit(extra);
      await GetCommitmentSignature(commitSig, erProvider.connection);
      const undelegateSig = await db.undelegate(extra);
      await GetCommitmentSignature(undelegateSig, erProvider.connection);
      await waitUndelegated(
        baseProvider.connection,
        db.slabPda,
        "slab",
        program.programId
      );
      await waitUndelegated(
        baseProvider.connection,
        db.catalogPda,
        "catalog",
        program.programId
      );
      await sleep(2000);
      const rows = await db.exec("SELECT * FROM notes WHERE id = 1");
      expect(rows).to.have.length(1);
      expect(rows[0].body).to.equal("er edited");
    });
  });
}
