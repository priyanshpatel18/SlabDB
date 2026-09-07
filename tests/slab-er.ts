import * as anchor from "@anchor-lang/core";
import { Program } from "@anchor-lang/core";
import { expect } from "chai";
import {
  ConnectionMagicRouter,
  DELEGATION_PROGRAM_ID,
  GetCommitmentSignature,
  MAGIC_CONTEXT_ID,
  MAGIC_PROGRAM_ID,
} from "@magicblock-labs/ephemeral-rollups-sdk";
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SendTransactionError,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import { Slab } from "../target/types/slab";
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

const LOCAL_VALIDATOR = new PublicKey(
  "mAGicPQYBMvcYveUZA5F5UNNwyHvfYh5xkLS2Fr1mev"
);
const DEFAULT_ROUTER = "https://devnet-router.magicblock.app/";
const DEFAULT_ER = "https://devnet-as.magicblock.app/";

type Remaining = {
  pubkey: PublicKey;
  isSigner: boolean;
  isWritable: boolean;
};

function requireBaseRpc(): string {
  const url = process.env.SLAB_BASE_RPC_URL || process.env.PROVIDER_ENDPOINT;
  if (!url) {
    throw new Error(
      "RUN_ER_TESTS=1 requires SLAB_BASE_RPC_URL (or PROVIDER_ENDPOINT). Do not use ANCHOR_PROVIDER_URL; anchor test forces localhost."
    );
  }
  return url;
}

function isLocalEndpoint(url: string): boolean {
  return url.includes("localhost") || url.includes("127.0.0.1");
}

function isGenericErAlias(url: string): boolean {
  try {
    return new URL(url).hostname === "devnet.magicblock.app";
  } catch {
    return false;
  }
}

async function sendTx(
  connection: Connection,
  tx: Transaction,
  payer: Keypair,
  label: string
): Promise<string> {
  tx.feePayer = payer.publicKey;
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  try {
    return await sendAndConfirmTransaction(connection, tx, [payer], {
      skipPreflight: true,
      commitment: "confirmed",
    });
  } catch (err: unknown) {
    let extra = String(err);
    if (err instanceof SendTransactionError) {
      const logs = await err.getLogs(connection).catch(() => []);
      extra = `${err.message}\n${(logs ?? []).join("\n")}`;
    }
    throw new Error(`${label} failed: ${extra}`);
  }
}

async function waitDelegated(
  connection: Connection,
  pubkey: PublicKey,
  label: string
) {
  for (let i = 0; i < 30; i++) {
    const info = await connection.getAccountInfo(pubkey);
    if (info && info.owner.equals(DELEGATION_PROGRAM_ID)) {
      return;
    }
    await sleep(500);
  }
  throw new Error(
    `${label} ${pubkey.toBase58()} is not owned by the delegation program`
  );
}

async function resolveErTarget(): Promise<{
  erUrl: string;
  remainingAccounts: Remaining[];
}> {
  if (process.env.VALIDATOR && process.env.EPHEMERAL_PROVIDER_ENDPOINT) {
    return {
      erUrl: process.env.EPHEMERAL_PROVIDER_ENDPOINT,
      remainingAccounts: [
        {
          pubkey: new PublicKey(process.env.VALIDATOR),
          isSigner: false,
          isWritable: false,
        },
      ],
    };
  }

  const erEnv = process.env.EPHEMERAL_PROVIDER_ENDPOINT;
  if (erEnv && isLocalEndpoint(erEnv)) {
    return {
      erUrl: erEnv,
      remainingAccounts: [
        { pubkey: LOCAL_VALIDATOR, isSigner: false, isWritable: false },
      ],
    };
  }

  const router = new ConnectionMagicRouter(
    process.env.ROUTER_ENDPOINT || DEFAULT_ROUTER,
    {
      wsEndpoint: process.env.WS_ROUTER_ENDPOINT || "wss://devnet-router.magicblock.app/",
      commitment: "confirmed",
    }
  );
  const closest = await router.getClosestValidator();
  if (!closest.identity) {
    throw new Error(
      "ConnectionMagicRouter.getClosestValidator returned no identity"
    );
  }
  const erUrl =
    closest.fqdn ||
    (erEnv && !isGenericErAlias(erEnv) ? erEnv : DEFAULT_ER);
  return {
    erUrl,
    remainingAccounts: [
      {
        pubkey: new PublicKey(closest.identity),
        isSigner: false,
        isWritable: false,
      },
    ],
  };
}

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

      const erBal = await erProvider.connection.getBalance(wallet.publicKey);
      if (erBal === 0) {
        const sig = await erProvider.connection.requestAirdrop(
          wallet.publicKey,
          LAMPORTS_PER_SOL
        );
        await erProvider.connection.confirmTransaction(sig, "confirmed");
      }
    });

    it("initialize + CREATE TABLE + INSERT on base, then delegate", async () => {
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

      const createTx = await program.methods
        .execSql(relOid, pkAttr, notesCreateTable)
        .accounts({
          authority: wallet.publicKey,
          slab: slabPda,
          catalog: catalogPda,
          feeVault: feeVaultPda,
          index: indexPda,
          systemProgram: SystemProgram.programId,
        })
        .transaction();
      await sendTx(baseProvider.connection, createTx, wallet.payer, "exec_sql");

      const insertTx = await program.methods
        .execInsert(relOid, pageNo, pkAttr, "notes", txid, hash, [
          { key: pk.key, keyLen: pk.keyLen, slot: 0 },
        ])
        .accounts({
          authority: wallet.publicKey,
          slab: slabPda,
          catalog: catalogPda,
          feeVault: feeVaultPda,
          pagePtr: pagePda,
          index: indexPda,
          systemProgram: SystemProgram.programId,
        })
        .transaction();
      await sendTx(baseProvider.connection, insertTx, wallet.payer, "exec_insert");

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
      await sendTx(baseProvider.connection, delegateTx, wallet.payer, "delegate");
      await waitDelegated(baseProvider.connection, slabPda, "slab");
      await waitDelegated(baseProvider.connection, catalogPda, "catalog");
      await waitDelegated(baseProvider.connection, indexPda, "index");
      await waitDelegated(baseProvider.connection, pagePda, "page_ptr");
      await sleep(3000);
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

      const catalogInfo = await erProvider.connection.getAccountInfo(catalogPda);
      if (!catalogInfo) {
        throw new Error("catalog missing on ER after SELECT");
      }
      const catalog = program.coder.accounts.decode<{ nRels: number }>(
        "catalog",
        catalogInfo.data
      );
      expect(catalog.nRels).to.equal(1);
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
      expect(nRels).to.equal(1);
    });
  });
}
