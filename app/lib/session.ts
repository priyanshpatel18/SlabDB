"use client";

import { Buffer } from "buffer";
import { AnchorProvider, Program } from "@anchor-lang/core";
import { Connection } from "@solana/web3.js";
import { SlabDb } from "@/client/db";
import type { RelInfo } from "@/client/catalog";
import { parseSql, splitStatements, type ParsedSql } from "@/lib/sql";
import type { Row } from "@/lib/sql-types";
import { BASE_RPC_URL, NS_LABEL, nsBytes } from "@/lib/cluster";
import { resolveErTarget } from "@/lib/er-target";
import { ErProvider } from "@/lib/er-provider";
import { BrowserIrysPageStore, type StatusFn } from "@/lib/irys-store";
import type { SlabSigner } from "@/lib/wallet";
import idl from "@/idl/slab.json";
import { withTimeout } from "@/client/timeout";

if (typeof globalThis.Buffer === "undefined") {
  (globalThis as unknown as { Buffer: typeof Buffer }).Buffer = Buffer;
}

export type ExecResult = {
  rows: Row[];
  message: string;
};

export type ChainSession = {
  db: SlabDb;
  delegated: boolean;
  rels: RelInfo[];
  erUrl: string;
  slab: string;
};

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

function needsEr(ast: ParsedSql): boolean {
  return (
    ast.kind === "insert" ||
    ast.kind === "update" ||
    ast.kind === "delete" ||
    ast.kind === "drop" ||
    ast.kind === "createIndex"
  );
}

function messageFor(ast: ParsedSql, rows: Row[]): string {
  if (ast.kind === "create") {
    return `CREATE TABLE ${ast.name} on base`;
  }
  if (ast.kind === "createIndex") {
    return `CREATE INDEX on ${ast.table}(${ast.column}) on ER`;
  }
  if (ast.kind === "insert") {
    const n = (ast.rows ?? [ast.values]).length;
    return `INSERT ${n} on ER`;
  }
  if (ast.kind === "update") {
    return "UPDATE on ER";
  }
  if (ast.kind === "delete") {
    return "DELETE on ER";
  }
  if (ast.kind === "drop") {
    return `DROP TABLE ${ast.name}`;
  }
  return `${rows.length} row${rows.length === 1 ? "" : "s"}`;
}

async function snapshot(db: SlabDb, erUrl: string): Promise<ChainSession> {
  let rels: RelInfo[] = [];
  try {
    rels = (await db.catalog()).rels;
  } catch {
    rels = [];
  }
  return {
    db,
    delegated: await db.isDelegated(),
    rels,
    erUrl,
    slab: db.slabPda.toBase58(),
  };
}

export async function openSession(wallet: SlabSigner): Promise<ChainSession> {
  if (!wallet.publicKey) {
    throw new Error("Sign in first");
  }
  const target = await resolveErTarget();
  const base = new Connection(BASE_RPC_URL, {
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
  const program = new Program(idl as never, baseProvider) as never;
  const programEr = new Program(idl as never, erProvider) as never;
  const db = new SlabDb({
    program,
    programEr,
    wallet: wallet.publicKey,
    ns: nsBytes(NS_LABEL),
    store: new BrowserIrysPageStore(),
    remainingAccounts: target.remainingAccounts,
  });
  await db.initialize();
  return snapshot(db, target.erUrl);
}

export async function delegateSession(
  session: ChainSession
): Promise<ChainSession> {
  if (await session.db.isDelegated()) {
    return snapshot(session.db, session.erUrl);
  }
  const catalog = await session.db.catalog();
  const rel = catalog.rels[0];
  if (!rel) {
    throw new Error("CREATE TABLE on base before delegate");
  }
  await session.db.delegate(rel.oid, 0, rel.pkAttr);
  await waitDelegated(session.db);
  return snapshot(session.db, session.erUrl);
}

export async function execSql(
  session: ChainSession,
  sql: string,
  onStatus: StatusFn = () => {}
): Promise<{ result: ExecResult; session: ChainSession }> {
  const store = session.db.store as BrowserIrysPageStore;
  if (typeof store.onStatus === "function" || "onStatus" in store) {
    store.onStatus = onStatus;
  }
  try {
    return await withTimeout(execSqlInner(session, sql, onStatus), 12_000, "SQL");
  } finally {
    if ("onStatus" in store) {
      store.onStatus = () => {};
    }
  }
}

async function execSqlInner(
  session: ChainSession,
  sql: string,
  onStatus: StatusFn
): Promise<{ result: ExecResult; session: ChainSession }> {
  const stmts = splitStatements(sql);
  if (stmts.length === 0) {
    throw new Error("SQL is empty");
  }
  let rows: Row[] = [];
  let message = "ok";
  for (const stmt of stmts) {
    const ast = parseSql(stmt);
    if (needsEr(ast) && !session.delegated) {
      throw new Error(
        "INSERT, UPDATE, DELETE, DROP, and CREATE INDEX run on the public ER. Delegate first."
      );
    }
    if (ast.kind === "insert") {
      onStatus("INSERT on ER");
    } else if (ast.kind === "select") {
      onStatus("SELECT");
    } else {
      onStatus(ast.kind);
    }
    rows = await session.db.exec(stmt);
    if (ast.kind === "create" && !session.delegated) {
      onStatus("Delegating to the public ER");
      const catalog = await session.db.catalog();
      const rel = catalog.rels.find((item: RelInfo) => item.name === ast.name);
      if (!rel) {
        throw new Error(`CREATE TABLE ${ast.name} did not land in the catalog`);
      }
      await session.db.delegate(rel.oid, 0, rel.pkAttr);
      await waitDelegated(session.db);
      session.delegated = true;
    }
    message = messageFor(ast, rows);
  }
  onStatus("Refreshing catalog");
  return {
    result: { rows, message },
    session: await snapshot(session.db, session.erUrl),
  };
}

export function statusLine(
  session: ChainSession | null,
  connected: boolean,
  agentEnabled = false
): string {
  if (!connected || !session) {
    return `ns=${NS_LABEL} store=none cluster=devnet lane=base delegated=no agent=no`;
  }
  const lane = session.delegated ? "er" : "base";
  const delegated = session.delegated ? "yes" : "no";
  const agent = agentEnabled ? "yes" : "no";
  return `ns=${NS_LABEL} store=session cluster=devnet lane=${lane} delegated=${delegated} agent=${agent}`;
}
