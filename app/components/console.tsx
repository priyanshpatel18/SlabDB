"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSlabWallet } from "@/hooks/use-slab-wallet";
import type { SlabSigner } from "@/lib/wallet";
import { Copy, RefreshCw, Search, Table2 } from "lucide-react";
import { toast } from "sonner";
import { PublicKey } from "@solana/web3.js";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { WalletButton } from "@/components/wallet-button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { RelInfo } from "slabdb";
import { UnreadablePageError } from "slabdb";
import {
  delegateSession,
  execSql,
  openSession,
  statusLine,
  type ChainSession,
  type ExecResult,
} from "@/lib/session";
import { fundIrys } from "@/lib/irys-store";
import { parseSql, splitStatements } from "@/lib/sql";
import { PAGE_BYTES, type SqlParam, type SqlValue } from "@/lib/sql-types";
import { NS_LABEL, shortAddr } from "@/lib/cluster";

function parseBindParams(text: string): SqlParam[] | undefined {
  const raw = text.trim();
  if (!raw) {
    return undefined;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('Params must be a JSON array, for example [1, "ada", "first note"]');
  }
  if (!Array.isArray(parsed)) {
    throw new Error('Params must be a JSON array, for example [1, "ada", "first note"]');
  }
  return parsed as SqlParam[];
}

const SAMPLE = `CREATE TABLE notes (id int8 PRIMARY KEY, author text NOT NULL, body text NOT NULL);`;
const EMPTY_RELS: RelInfo[] = [];

function formatValue(value: SqlValue): string {
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "boolean") return value ? "true" : "false";
  if (value instanceof Uint8Array) {
    return `\\x${Array.from(value, (b) => b.toString(16).padStart(2, "0")).join("")}`;
  }
  if (value !== null && typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
}

function tableFromSql(sql: string): string | null {
  const stmts = splitStatements(sql);
  for (let i = stmts.length - 1; i >= 0; i--) {
    try {
      const ast = parseSql(stmts[i]);
      if (
        ast.kind === "select" ||
        ast.kind === "insert" ||
        ast.kind === "update" ||
        ast.kind === "delete" ||
        ast.kind === "createIndex"
      ) {
        return ast.table;
      }
      if (ast.kind === "create" || ast.kind === "drop") {
        return ast.name;
      }
    } catch {
      continue;
    }
  }
  const named = /\b(?:from|into|update|table)\s+"?([a-z_][a-z0-9_]*)"?/i.exec(
    sql
  );
  return named?.[1]?.toLowerCase() ?? null;
}

export function Console() {
  const wallet = useSlabWallet();
  const { publicKey, connected, agentEnabled, agentAvailable, enableAgent } =
    wallet;

  const signer = useMemo<SlabSigner | null>(() => {
    if (!publicKey || !connected) return null;
    return {
      publicKey,
      signTransaction: wallet.signTransaction,
      signAllTransactions: wallet.signAllTransactions,
      signMessage: wallet.signMessage,
    };
  }, [
    publicKey,
    connected,
    wallet.signTransaction,
    wallet.signAllTransactions,
    wallet.signMessage,
  ]);

  const signerId = signer?.publicKey.toBase58() ?? "";
  const [session, setSession] = useState<ChainSession | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);
  const [booting, setBooting] = useState(false);
  const [sql, setSql] = useState(SAMPLE);
  const [paramsText, setParamsText] = useState("");
  const [result, setResult] = useState<ExecResult>({ rows: [], message: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [runStatus, setRunStatus] = useState<string | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [granteeText, setGranteeText] = useState("");
  const [boundId, setBoundId] = useState(signerId);

  if (signerId !== boundId) {
    setBoundId(signerId);
    setSession(null);
    setBootError(null);
    setResult({ rows: [], message: "" });
    setError(null);
    setActive(null);
    setBooting(Boolean(signerId));
  }

  useEffect(() => {
    if (!signer) return;
    let cancelled = false;
    void openSession(signer)
      .then((next) => {
        if (cancelled) return;
        setSession(next);
        setActive(next.rels[0]?.name ?? null);
        setResult({
          rows: [],
          message: next.rels.length
            ? `Loaded ${next.rels.length} table${next.rels.length === 1 ? "" : "s"} for this wallet`
            : "Slab ready. CREATE TABLE on base, then INSERT on the public ER.",
        });
        setBooting(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setSession(null);
        setBootError(err instanceof Error ? err.message : "Could not open slab");
        setBooting(false);
      });
    return () => {
      cancelled = true;
    };
  }, [signer]);

  const apply = useCallback((nextSql: string, next: ExecResult, table?: string) => {
    setSql(nextSql);
    setResult(next);
    setError(null);
    setActive((prev) => table ?? tableFromSql(nextSql) ?? prev);
  }, []);

  const runSql = useCallback(
    (source: string) => {
      if (!session) {
        setError("Sign in first");
        return;
      }
      let params: SqlParam[] | undefined;
      try {
        params = parseBindParams(paramsText);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Params are invalid");
        return;
      }
      setSql(source);
      setBusy(true);
      setRunStatus("Running");
      setError(null);
      void execSql(session, source, setRunStatus, params)
        .then(({ result: next, session: updated }) => {
          setSession(updated);
          apply(source, next);
        })
        .catch((err) => {
          const table = tableFromSql(source);
          let msg = err instanceof Error ? err.message : "SQL failed";
          if (err instanceof UnreadablePageError) {
            msg = err.message;
            setSql(err.dropSql ? `${err.dropSql};` : "DROP TABLE");
          } else if (table && /not on Irys|another tab|Irys GET failed/i.test(msg)) {
            msg = `Rows in ${table} are not on Irys. Run DROP TABLE ${table}; then CREATE TABLE and INSERT again.`;
            setSql(`DROP TABLE ${table};`);
          }
          setError(msg);
          setResult({ rows: [], message: "" });
          if (table) setActive(table);
        })
        .finally(() => {
          setBusy(false);
          setRunStatus(null);
        });
    },
    [session, apply, paramsText],
  );

  const reload = useCallback(() => {
    if (!signer) return;
    setBooting(true);
    setBootError(null);
    void openSession(signer)
      .then((next) => {
        setSession(next);
        setActive((prev) =>
          next.rels.some((rel) => rel.name === prev) ? prev : (next.rels[0]?.name ?? null)
        );
        setError(null);
        setResult({
          rows: [],
          message: "Reloaded catalog from chain",
        });
      })
      .catch((err) => {
        setBootError(err instanceof Error ? err.message : "Could not reload slab");
      })
      .finally(() => setBooting(false));
  }, [signer]);

  const delegate = useCallback(() => {
    if (!session) return;
    setBusy(true);
    void delegateSession(session)
      .then((updated) => {
        setSession(updated);
        toast.success("Delegated to the public ER");
      })
      .catch((err) => {
        toast.error(err instanceof Error ? err.message : "Delegate failed");
      })
      .finally(() => setBusy(false));
  }, [session]);

  const fund = useCallback(() => {
    if (!signer) return;
    setBusy(true);
    setRunStatus("Signing Irys fund");
    setError(null);
    void fundIrys(signer, setRunStatus)
      .then(() => {
        toast.success("Irys prepaid. Optional for durable pages.");
      })
      .catch((err) => {
        const msg = err instanceof Error ? err.message : "Irys fund failed";
        setError(msg);
        toast.error(msg);
      })
      .finally(() => {
        setBusy(false);
        setRunStatus(null);
      });
  }, [signer]);

  const runAcl = useCallback(
    (kind: "GRANT" | "REVOKE") => {
      let pk: PublicKey;
      try {
        pk = new PublicKey(granteeText.trim());
      } catch {
        setError("Writer pubkey must be base58");
        return;
      }
      runSql(`${kind} ${pk.toBase58()}`);
    },
    [granteeText, runSql],
  );

  const inspect = useCallback(
    (name: string) => {
      runSql(`SELECT * FROM ${name};`);
    },
    [runSql],
  );

  const tables = session?.rels ?? EMPTY_RELS;
  const rowTotal = tables.reduce((n, rel) => n + rel.nTuples, 0);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return tables;
    return tables.filter((rel) => rel.name.includes(q));
  }, [tables, query]);

  const activeRel = tables.find((rel) => rel.name === active);
  const columns = result.rows.length > 0 ? Object.keys(result.rows[0]) : [];
  const tenant = publicKey ? shortAddr(publicKey.toBase58()) : "no wallet";
  const previewLine = statusLine(session, connected, agentEnabled);
  const canRun = Boolean(session) && !busy && !booting;

  return (
    <div className="flex h-dvh w-full max-w-[100vw] min-w-0 overflow-x-hidden bg-background">
      <aside className="hidden w-72 shrink-0 flex-col border-r border-sidebar-border bg-sidebar md:flex">
        <Link
          href="/"
          className="flex h-14 shrink-0 items-center gap-2 border-b border-sidebar-border px-4"
        >
          <span className="font-display text-xl italic leading-none tracking-tight">
            Slab
          </span>
        </Link>
        <div className="px-4 py-4">
          <p className="text-sm font-medium">{NS_LABEL}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Isolation [slab, embedded wallet, ns]
          </p>
        </div>
        <div className="px-3 pb-3">
          <label className="sr-only" htmlFor="table-search">
            Filter tables
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="table-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter tables"
              className="h-9 pl-8"
            />
          </div>
        </div>
        <p className="px-4 pb-2 text-xs font-medium text-muted-foreground">
          Tables
        </p>
        <ScrollArea className="min-h-0 flex-1 px-2 pb-3">
          {filtered.length === 0 ? (
            <p className="px-2 py-6 text-center text-sm text-muted-foreground">
              {tables.length === 0
                ? connected
                  ? "No tables on this slab"
                  : "Sign in"
                : "No tables match that filter"}
            </p>
          ) : (
            <ul className="flex flex-col gap-0.5">
              {filtered.map((rel) => {
                const selected = rel.name === active;
                return (
                  <li key={rel.oid}>
                    <button
                      type="button"
                      aria-current={selected ? "true" : undefined}
                      className={cn(
                        "flex min-h-11 w-full items-center gap-3 rounded-md px-2 py-2 text-left",
                        selected
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : "hover:bg-sidebar-accent/70",
                      )}
                      onClick={() => inspect(rel.name)}
                    >
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-kiln/15 font-mono text-xs text-kiln">
                        {rel.name.slice(0, 1)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">
                          {rel.name}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {rel.nTuples} {rel.nTuples === 1 ? "row" : "rows"}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </ScrollArea>
      </aside>

      <div className="relative flex min-w-0 w-full flex-1 flex-col overflow-x-hidden pt-[env(safe-area-inset-top)] md:pt-0">
        <div className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border px-4 sm:px-6">
          <Link href="/" className="flex shrink-0 items-center md:hidden">
            <span className="font-display text-xl italic leading-none tracking-tight">
              Slab
            </span>
          </Link>
          <p className="hidden text-sm text-muted-foreground md:block">
            {session
              ? session.delegated
                ? "Public ER"
                : "Base layer"
              : "Sign in"}
          </p>
          <div className="ml-auto flex items-center gap-3">
            <Link
              href="/docs"
              className="hidden text-sm text-muted-foreground hover:text-foreground sm:inline"
            >
              Docs
            </Link>
            <WalletButton />
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
              <div className="min-w-0">
                <h1 className="text-2xl font-medium tracking-tight">
                  {activeRel ? activeRel.name : "SQL"}
                </h1>
                <p className="mt-1 text-sm break-words text-muted-foreground">
                  {activeRel
                    ? `oid ${activeRel.oid} · ${activeRel.columns.map((c: { name: string; typ: string }) => `${c.name} ${c.typ}`).join(", ")}`
                    : "Postgres SQL. CREATE TABLE on base. INSERT on the public ER. GRANT a writer pubkey to share the catalog."}
                </p>
              </div>
              <div className="flex w-full gap-2 sm:w-auto sm:flex-wrap sm:items-center">
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 min-w-0 flex-1 sm:flex-none"
                  disabled={!connected || booting || busy}
                  onClick={reload}
                >
                  <RefreshCw />
                  <span className="sm:hidden">Reload</span>
                  <span className="hidden sm:inline">Reload catalog</span>
                </Button>
                {session && !session.delegated && session.rels.length > 0 ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="h-10 min-w-0 flex-1 sm:flex-none"
                    disabled={busy}
                    onClick={delegate}
                  >
                    Delegate
                  </Button>
                ) : null}
                {session && agentAvailable && !agentEnabled ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="h-10 min-w-0 flex-1 sm:flex-none"
                    disabled={busy}
                    onClick={() => {
                      setBusy(true);
                      void enableAgent()
                        .catch((err) => {
                          toast.error(
                            err instanceof Error
                              ? err.message
                              : "Could not enable agent",
                          );
                        })
                        .finally(() => setBusy(false));
                    }}
                  >
                    Enable agent
                  </Button>
                ) : null}
                {session?.delegated ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="h-10 min-w-0 flex-1 sm:flex-none"
                    disabled={busy}
                    onClick={fund}
                  >
                    Fund Irys
                  </Button>
                ) : null}
                <Button
                  type="button"
                  className="h-10 min-w-0 flex-1 sm:flex-none"
                  disabled={!canRun}
                  aria-busy={busy}
                  onClick={() => runSql(sql)}
                >
                  {busy ? "Running" : "Run"}
                </Button>
              </div>
            </div>

            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ["Tables", String(tables.length)],
                ["Rows", String(rowTotal)],
                ["Page", `${PAGE_BYTES.toLocaleString()} B`],
                [
                  "Lane",
                  session?.delegated ? "ER" : connected ? "Base" : "None",
                ],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="min-w-0 rounded-lg border border-border bg-card px-3 py-3 sm:px-4"
                >
                  <dt className="text-xs text-muted-foreground">{label}</dt>
                  <dd className="mt-1 truncate font-mono text-lg tabular-nums sm:text-xl">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>

            <div className="flex gap-2 overflow-x-auto md:hidden">
              {tables.map((rel) => (
                <Button
                  key={rel.oid}
                  type="button"
                  size="sm"
                  variant={rel.name === active ? "default" : "outline"}
                  className="min-h-10 shrink-0"
                  onClick={() => inspect(rel.name)}
                >
                  {rel.name}
                </Button>
              ))}
            </div>

            <section className="overflow-hidden rounded-lg border border-border bg-card">
              <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5">
                <p className="text-sm font-medium">Query</p>
                <p className="min-w-0 truncate text-xs text-muted-foreground">
                  {runStatus ?? "Ctrl+Enter"}
                </p>
              </div>
              <label className="sr-only" htmlFor="slab-sql">
                SQL query
              </label>
              <Textarea
                id="slab-sql"
                value={sql}
                spellCheck={false}
                onChange={(e) => setSql(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                    e.preventDefault();
                    if (canRun) runSql(sql);
                  }
                }}
                className="min-h-36 resize-y rounded-none border-0 bg-transparent px-4 py-3 font-mono text-sm dark:bg-transparent"
              />
              <div className="border-t border-border px-4 py-2.5">
                <label className="sr-only" htmlFor="slab-sql-params">
                  SQL params JSON array
                </label>
                <Input
                  id="slab-sql-params"
                  value={paramsText}
                  spellCheck={false}
                  placeholder='Params JSON array, for example [1, "ada", "first note"]'
                  onChange={(e) => setParamsText(e.target.value)}
                  onKeyDown={(e) => {
                    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                      e.preventDefault();
                      if (canRun) runSql(sql);
                    }
                  }}
                  className="h-9 border-0 bg-transparent px-0 font-mono text-sm shadow-none focus-visible:ring-0 dark:bg-transparent"
                />
              </div>
            </section>

            <section className="overflow-hidden rounded-lg border border-border bg-card">
              <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5">
                <p className="text-sm font-medium">Writers</p>
                <p className="min-w-0 truncate text-xs text-muted-foreground">
                  Owner only
                </p>
              </div>
              <div className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center">
                <label className="sr-only" htmlFor="slab-grant-writer">
                  Writer pubkey
                </label>
                <Input
                  id="slab-grant-writer"
                  value={granteeText}
                  spellCheck={false}
                  placeholder="Writer pubkey (base58)"
                  onChange={(e) => setGranteeText(e.target.value)}
                  onKeyDown={(e) => {
                    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                      e.preventDefault();
                      if (canRun) runAcl("GRANT");
                    }
                  }}
                  className="h-9 font-mono text-sm sm:flex-1"
                />
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-10 min-w-0 flex-1 sm:flex-none"
                    disabled={!canRun}
                    onClick={() => runAcl("GRANT")}
                  >
                    Grant
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-10 min-w-0 flex-1 sm:flex-none"
                    disabled={!canRun}
                    onClick={() => runAcl("REVOKE")}
                  >
                    Revoke
                  </Button>
                </div>
              </div>
              <p className="px-4 pb-3 text-xs text-muted-foreground">
                GRANT lets that wallet INSERT, UPDATE, and DELETE on this slab.
                GRANT runs on base. SELECT does not need GRANT. You can also run
                GRANT or REVOKE in the Query box.
              </p>
            </section>

            <section className="overflow-hidden rounded-lg border border-border bg-card">
              <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <Table2 className="size-3.5 text-muted-foreground" />
                  <p className="text-sm font-medium">
                    {error || bootError
                      ? "Result"
                      : result.rows.length > 0
                        ? `${result.rows.length} ${result.rows.length === 1 ? "row" : "rows"}`
                        : "Result"}
                  </p>
                </div>
                {!error && !bootError && result.message ? (
                  <p className="truncate text-xs text-muted-foreground">
                    {result.message}
                  </p>
                ) : null}
              </div>
              {bootError ? (
                <Alert variant="destructive" className="m-4">
                  <AlertTitle>Could not open slab</AlertTitle>
                  <AlertDescription>{bootError}</AlertDescription>
                </Alert>
              ) : null}
              {error ? (
                <Alert variant="destructive" className="m-4">
                  <AlertTitle>Could not run SQL</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : null}
              {!error && !bootError && result.rows.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table className="font-mono text-sm">
                    <TableHeader>
                      <TableRow>
                        {columns.map((col) => (
                          <TableHead
                            key={col}
                            className="bg-card px-4 text-xs text-muted-foreground"
                          >
                            {col}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {result.rows.map((row, i) => (
                        <TableRow key={i}>
                          {columns.map((col) => (
                            <TableCell key={col} className="px-4">
                              {formatValue(row[col])}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : null}
              {!error && !bootError && result.rows.length === 0 && result.message ? (
                <p className="px-4 py-6 text-sm text-muted-foreground">
                  {result.message}
                </p>
              ) : null}
              {!error && !bootError && !result.message && !booting ? (
                <Empty className="border-0 py-10">
                  <EmptyHeader>
                    <EmptyTitle>
                      {connected ? "No result" : "Sign in"}
                    </EmptyTitle>
                    <EmptyDescription>
                      {connected
                        ? "Run a SELECT to fill this table."
                        : "The catalog is [slab, wallet, ns]. There is no shared demo table."}
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : null}
              {booting ? (
                <p className="px-4 py-6 text-sm text-muted-foreground">
                  Opening slab for this wallet...
                </p>
              ) : null}
            </section>
            <div className="h-14" />
          </div>
        </div>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-4 sm:pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="pointer-events-auto flex w-[calc(100%-0.5rem)] max-w-xl items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 shadow-lg sm:w-auto sm:max-w-full sm:gap-3">
            <span className="size-1.5 shrink-0 rounded-full bg-kiln" aria-hidden />
            <code className="min-w-0 flex-1 truncate font-mono text-xs">
              {previewLine}
              <span className="text-muted-foreground"> · {tenant}</span>
            </code>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-9 shrink-0"
              onClick={() => {
                void navigator.clipboard.writeText(previewLine).then(
                  () => toast.success("Copied"),
                  () => toast.error("Could not copy"),
                );
              }}
            >
              <Copy />
              <span className="hidden sm:inline">Copy</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
