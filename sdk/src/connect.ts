import { AnchorProvider, Program } from "@anchor-lang/core";
import {
  Connection,
  PublicKey,
  Transaction,
  VersionedTransaction,
} from "@solana/web3.js";
import {
  DEFAULT_BASE_RPC,
  DEFAULT_ER_ROUTER,
  DEFAULT_ER_WS,
  nsBytes,
} from "./config";
import { SlabDb, type Remaining } from "./db";
import { ErProvider } from "./er-provider";
import { resolveErTarget } from "./er-target";
import type { Slab as SlabProgram } from "./idl";
import type { PageStore } from "./store";
import type { Row, SqlParam } from "./types";
import slabIdl from "./idl.json";

export type SlabWallet = {
  publicKey: PublicKey;
  signTransaction: <T extends Transaction | VersionedTransaction>(
    tx: T
  ) => Promise<T>;
  signAllTransactions?: <T extends Transaction | VersionedTransaction>(
    txs: T[]
  ) => Promise<T[]>;
};

export type ConnectOpts = {
  wallet: SlabWallet;
  ns: string | number[];
  store: PageStore;
  /** Catalog owner. Default is the connected wallet. Shared catalogs use this pubkey. */
  owner?: PublicKey;
  baseRpc?: string;
  erRouter?: string;
  erWs?: string;
  remainingAccounts?: Remaining[];
  autoDelegate?: boolean;
};

export type SlabClient = {
  db: SlabDb;
  delegated: boolean;
  erUrl: string;
  owner: PublicKey;
  wallet: PublicKey;
  exec: (sql: string, params?: SqlParam[]) => Promise<Row[]>;
  grant: (grantee: PublicKey) => Promise<void>;
  revoke: (grantee: PublicKey) => Promise<void>;
};

function asAnchorWallet(wallet: SlabWallet) {
  return {
    publicKey: wallet.publicKey,
    signTransaction: wallet.signTransaction.bind(wallet),
    signAllTransactions: async <T extends Transaction | VersionedTransaction>(
      txs: T[]
    ): Promise<T[]> => {
      if (wallet.signAllTransactions) {
        return wallet.signAllTransactions(txs);
      }
      const out: T[] = [];
      for (const tx of txs) {
        out.push(await wallet.signTransaction(tx));
      }
      return out;
    },
  };
}

function timedFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  return fetch(input, { ...init, signal: AbortSignal.timeout(12_000) });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitDelegated(db: SlabDb): Promise<void> {
  for (let i = 0; i < 40; i++) {
    if (await db.isDelegated()) {
      return;
    }
    await sleep(80);
  }
  throw new Error("Slab is not owned by the delegation program yet");
}

/**
 * One call: programs, RPCs, initialize, optional delegate, SQL routing.
 * Browser apps should import `connect` from `slabdb/web` so the Irys store is included.
 */
export async function connect(opts: ConnectOpts): Promise<SlabClient> {
  if (!opts.wallet.publicKey) {
    throw new Error("wallet publicKey is required");
  }
  const ns = nsBytes(opts.ns);
  const owner = opts.owner ?? opts.wallet.publicKey;
  const autoDelegate = opts.autoDelegate !== false;
  const target = await resolveErTarget({
    router: opts.erRouter ?? DEFAULT_ER_ROUTER,
    ws: opts.erWs ?? DEFAULT_ER_WS,
  });
  const remaining = opts.remainingAccounts ?? target.remainingAccounts;
  const wallet = asAnchorWallet(opts.wallet);
  const base = new Connection(opts.baseRpc ?? DEFAULT_BASE_RPC, {
    commitment: "confirmed",
    confirmTransactionInitialTimeout: 12_000,
    fetch: timedFetch,
  });
  const er = new Connection(target.erUrl, {
    commitment: "processed",
    confirmTransactionInitialTimeout: 12_000,
    fetch: timedFetch,
  });
  const baseProvider = new AnchorProvider(base, wallet, {
    commitment: "confirmed",
  });
  const erProvider = new ErProvider(er, wallet, {
    commitment: "processed",
    skipPreflight: true,
  });
  const program = new Program(slabIdl as never, baseProvider) as Program<SlabProgram>;
  const programEr = new Program(slabIdl as never, erProvider) as Program<SlabProgram>;
  const db = new SlabDb({
    program,
    programEr,
    wallet: opts.wallet.publicKey,
    owner,
    ns,
    store: opts.store,
    remainingAccounts: remaining,
    autoDelegate,
  });
  await db.initialize();
  if (autoDelegate && !(await db.isDelegated())) {
    try {
      const catalog = await db.catalog();
      const rel = catalog.rels[0];
      if (rel) {
        await db.delegate(rel.oid, 0, rel.pkAttr);
        await waitDelegated(db);
      }
    } catch {
      /* empty catalog: first CREATE TABLE will delegate */
    }
  }
  let delegated = await db.isDelegated();
  const client: SlabClient = {
    db,
    delegated,
    erUrl: target.erUrl,
    owner,
    wallet: opts.wallet.publicKey,
    exec: async (sql: string, params?: SqlParam[]): Promise<Row[]> => {
      const rows = await db.exec(sql, params);
      client.delegated = await db.isDelegated();
      return rows;
    },
    grant: (grantee) => db.grant(grantee),
    revoke: (grantee) => db.revoke(grantee),
  };
  return client;
}
