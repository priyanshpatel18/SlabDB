"use client";

import { Buffer } from "buffer";
import { withTimeout, type RelInfo, type SqlParam } from "slabdb";
import { Slab, BrowserIrysPageStore, type StatusFn } from "slabdb/web";
import { parseSql, splitStatements, type ParsedSql } from "@/lib/sql";
import type { Row } from "@/lib/sql-types";
import { NS_LABEL } from "@/lib/cluster";
import type { SlabSigner } from "@/lib/wallet";

if (typeof globalThis.Buffer === "undefined") {
  (globalThis as unknown as { Buffer: typeof Buffer }).Buffer = Buffer;
}

export type ExecResult = {
  rows: Row[];
  message: string;
};

export type ChainSession = {
  db: import("slabdb").SlabDb;
  delegated: boolean;
  rels: RelInfo[];
  erUrl: string;
  slab: string;
};

function messageFor(ast: ParsedSql, rows: Row[]): string {
  if (ast.kind === "create") {
    return `CREATE TABLE ${ast.name}`;
  }
  if (ast.kind === "createIndex") {
    return `CREATE INDEX on ${ast.table}(${ast.column})`;
  }
  if (ast.kind === "insert") {
    const n = (ast.rows ?? [ast.values]).length;
    return `INSERT ${n}`;
  }
  if (ast.kind === "update") {
    return "UPDATE";
  }
  if (ast.kind === "delete") {
    return "DELETE";
  }
  if (ast.kind === "drop") {
    return `DROP TABLE ${ast.name}`;
  }
  return `${rows.length} row${rows.length === 1 ? "" : "s"}`;
}

async function snapshot(
  db: ChainSession["db"],
  erUrl: string
): Promise<ChainSession> {
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
  const client = await Slab.connect({
    wallet,
    ns: NS_LABEL,
  });
  return snapshot(client.db, client.erUrl);
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
  for (let i = 0; i < 40; i++) {
    if (await session.db.isDelegated()) {
      return snapshot(session.db, session.erUrl);
    }
    await new Promise((r) => setTimeout(r, 80));
  }
  throw new Error("Slab is not owned by the delegation program yet");
}

export async function execSql(
  session: ChainSession,
  sql: string,
  onStatus: StatusFn = () => {},
  params?: SqlParam[]
): Promise<{ result: ExecResult; session: ChainSession }> {
  const store = session.db.store as BrowserIrysPageStore;
  if (typeof store.onStatus === "function" || "onStatus" in store) {
    store.onStatus = onStatus;
  }
  try {
    return await withTimeout(
      execSqlInner(session, sql, onStatus, params),
      90_000,
      "SQL"
    );
  } finally {
    if ("onStatus" in store) {
      store.onStatus = () => {};
    }
  }
}

async function execSqlInner(
  session: ChainSession,
  sql: string,
  onStatus: StatusFn,
  params?: SqlParam[]
): Promise<{ result: ExecResult; session: ChainSession }> {
  const stmts = splitStatements(sql);
  if (stmts.length === 0) {
    throw new Error("SQL is empty");
  }
  let rows: Row[] = [];
  let message = "ok";
  for (const stmt of stmts) {
    const ast = parseSql(stmt, params);
    if (ast.kind === "insert") {
      onStatus("INSERT");
    } else if (ast.kind === "select") {
      onStatus("SELECT");
    } else {
      onStatus(ast.kind);
    }
    rows = await session.db.exec(stmt, params);
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
  return `ns=${NS_LABEL} store=irys cluster=devnet lane=${lane} delegated=${delegated} agent=${agent}`;
}
