"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";
import { Copy, RotateCcw, Search, Table2 } from "lucide-react";
import { toast } from "sonner";
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
import { MemoryCatalog, type ExecResult } from "@/lib/engine";
import { parseSql, splitStatements } from "@/lib/sql";
import { PAGE_BYTES, type SqlValue } from "@/lib/sql-types";
import { shortAddr } from "@/lib/cluster";

const NS = "default";
const SAMPLE = `CREATE TABLE notes (id int8 PRIMARY KEY, author text NOT NULL, body text NOT NULL);
INSERT INTO notes (id, author, body) VALUES (1, 'ada', 'first note');
INSERT INTO notes (id, author, body) VALUES (2, 'sam', 'second');
SELECT * FROM notes;`;
const INSPECT = "SELECT * FROM notes;";

function formatValue(value: SqlValue): string {
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value);
}

function seedCatalog() {
  const catalog = new MemoryCatalog();
  const result = catalog.execMany(SAMPLE);
  return { catalog, result };
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
  return null;
}

export function Console() {
  const boot = useRef<ReturnType<typeof seedCatalog> | null>(null);
  if (!boot.current) boot.current = seedCatalog();
  const catalogRef = useRef(boot.current.catalog);
  const { publicKey } = useWallet();

  const [sql, setSql] = useState(INSPECT);
  const [result, setResult] = useState<ExecResult>(boot.current.result);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [active, setActive] = useState("notes");
  const [query, setQuery] = useState("");
  const [rev, setRev] = useState(0);
  const catalog = catalogRef.current;
  void rev;

  const apply = useCallback((nextSql: string, next: ExecResult) => {
    setSql(nextSql);
    setResult(next);
    setError(null);
    setActive((prev) => tableFromSql(nextSql) ?? prev);
    setRev((n) => n + 1);
  }, []);

  const runSql = useCallback(
    (source: string) => {
      setBusy(true);
      try {
        const next = catalogRef.current.execMany(source);
        apply(source, next);
      } catch (err) {
        setError(err instanceof Error ? err.message : "SQL failed");
        setResult({ rows: [], message: "" });
        const t = tableFromSql(source);
        if (t) setActive(t);
        setRev((n) => n + 1);
      } finally {
        setBusy(false);
      }
    },
    [apply],
  );

  const resetDemo = useCallback(() => {
    const next = seedCatalog();
    catalogRef.current = next.catalog;
    boot.current = next;
    setSql(INSPECT);
    setResult(next.result);
    setError(null);
    setActive("notes");
    setQuery("");
    setRev((n) => n + 1);
  }, []);

  const inspect = useCallback(
    (name: string) => {
      runSql(`SELECT * FROM ${name};`);
    },
    [runSql],
  );

  const tables = catalog.rels;
  const rowTotal = tables.reduce((n, rel) => n + rel.rows.length, 0);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return tables;
    return tables.filter((rel) => rel.name.includes(q));
  }, [tables, query, rev]);

  const activeRel = tables.find((rel) => rel.name === active);
  const columns = result.rows.length > 0 ? Object.keys(result.rows[0]) : [];
  const tenant = publicKey ? shortAddr(publicKey.toBase58()) : "no wallet";
  const previewLine = `ns=${NS} store=memory cluster=devnet`;

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
          <p className="text-sm font-medium">default</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Namespace · in memory
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
                  ? "No tables yet"
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
                            {rel.rows.length}{" "}
                            {rel.rows.length === 1 ? "row" : "rows"}
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
              In-memory preview
            </p>
            <WalletButton />
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
                      ? `oid ${activeRel.oid} · ${activeRel.columns.map((c) => `${c.name} ${c.typ}`).join(", ")}`
                      : "Run v0 SQL against the in-memory catalog"}
                  </p>
                </div>
                <div className="flex w-full gap-2 sm:w-auto sm:flex-wrap sm:items-center">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-10 min-w-0 flex-1 sm:flex-none"
                    onClick={resetDemo}
                  >
                    <RotateCcw />
                    <span className="sm:hidden">Reset</span>
                    <span className="hidden sm:inline">Reset demo</span>
                  </Button>
                  <Button
                    type="button"
                    className="h-10 min-w-0 flex-1 sm:flex-none"
                    disabled={busy}
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
                  ["Store", "Memory"],
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
                  <p className="text-xs text-muted-foreground">Ctrl+Enter</p>
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
                      runSql(sql);
                    }
                  }}
                  className="min-h-36 resize-y rounded-none border-0 bg-transparent px-4 py-3 font-mono text-sm dark:bg-transparent"
                />
              </section>

              <section className="overflow-hidden rounded-lg border border-border bg-card">
                <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <Table2 className="size-3.5 text-muted-foreground" />
                    <p className="text-sm font-medium">
                      {error
                        ? "Result"
                        : result.rows.length > 0
                          ? `${result.rows.length} ${result.rows.length === 1 ? "row" : "rows"}`
                          : "Result"}
                    </p>
                  </div>
                  {!error && result.message ? (
                    <p className="truncate text-xs text-muted-foreground">
                      {result.message}
                    </p>
                  ) : null}
                </div>
                {error ? (
                  <Alert variant="destructive" className="m-4">
                    <AlertTitle>Could not run SQL</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                ) : null}
                {!error && result.rows.length > 0 ? (
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
                {!error && result.rows.length === 0 && result.message ? (
                  <p className="px-4 py-6 text-sm text-muted-foreground">
                    {result.message}
                  </p>
                ) : null}
                {!error && !result.message ? (
                  <Empty className="border-0 py-10">
                    <EmptyHeader>
                      <EmptyTitle>No result</EmptyTitle>
                      <EmptyDescription>
                        Run a SELECT to fill this table.
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
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
