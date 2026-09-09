"use client";

import { useEffect, useState } from "react";
import { useReducedMotion } from "motion/react";

const QUERY = "SELECT * FROM notes;";
const KEYWORDS = new Set(["SELECT", "FROM", "WHERE"]);

const ROWS = [
  { id: "1", author: "ada", body: "first note", off: "0x20" },
  { id: "2", author: "sam", body: "second", off: "0x48" },
] as const;

function paintSql(source: string) {
  return source.split(/(\s+|;|\*)/).map((token, i) => {
    if (KEYWORDS.has(token)) {
      return (
        <span key={i} className="text-kiln">
          {token}
        </span>
      );
    }
    return <span key={i}>{token}</span>;
  });
}

export function QueryStage() {
  const reduce = useReducedMotion();
  if (reduce) {
    return <QueryStageView typed={QUERY.length} />;
  }
  return <QueryStageTyped />;
}

function QueryStageTyped() {
  const [typed, setTyped] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setTyped((n) => {
        if (n >= QUERY.length) {
          window.clearInterval(id);
          return n;
        }
        return n + 1;
      });
    }, 28);
    return () => window.clearInterval(id);
  }, []);

  return <QueryStageView typed={typed} />;
}

function QueryStageView({ typed }: { typed: number }) {
  const [focus, setFocus] = useState(0);
  const done = typed >= QUERY.length;

  useEffect(() => {
    if (!done) return;
    const id = window.setInterval(() => {
      setFocus((n) => (n + 1) % ROWS.length);
    }, 2200);
    return () => window.clearInterval(id);
  }, [done]);

  return (
    <aside
      aria-label="Slab console preview"
      className="slab-terminal flex min-h-[16rem] w-full min-w-0 max-w-full flex-col overflow-hidden lg:min-h-[22rem]"
    >
      <div className="slab-terminal-edge" aria-hidden />

      <div className="flex items-center justify-between gap-3 px-3 py-2.5 sm:px-4">
        <p className="min-w-0 truncate font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
          Slab / notes
        </p>
        <p className="flex shrink-0 items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
          <span className="size-1.5 rounded-full bg-kiln" aria-hidden />
          <span className="sm:hidden">Preview</span>
          <span className="hidden sm:inline">Preview · devnet</span>
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-y border-border px-3 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground sm:gap-3 sm:px-4 sm:tracking-[0.14em]">
        <span className="shrink-0 text-kiln">Query</span>
        <span aria-hidden>→</span>
        <span className="shrink-0">
          <span className="hidden sm:inline">Public </span>ER
        </span>
        <span aria-hidden>→</span>
        <span className="min-w-0 shrink-0">Irys · 8,192 B</span>
        <span
          className="ml-auto hidden h-1 w-16 shrink-0 bg-muted sm:block"
          aria-hidden
        >
          <span className="block h-full w-[76%] bg-kiln" />
        </span>
      </div>

      <div className="flex min-h-0 flex-1">
        <div className="hidden w-[8.5rem] shrink-0 flex-col border-r border-border p-3 sm:flex">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            Catalog
          </p>
          <div className="mt-3 rounded-[var(--radius)] bg-kiln/10 px-2 py-2">
            <p className="text-sm font-medium">notes</p>
            <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
              2 rows · page 0
            </p>
          </div>
          <p className="mt-auto pt-6 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            Page 00001
          </p>
          <div className="mt-2 h-1 bg-muted" aria-hidden>
            <div className="h-full w-[76%] bg-kiln" />
          </div>
          <p className="mt-1.5 font-mono text-[10px] text-muted-foreground">
            6.2 KB / 8,192 B
          </p>
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="slab-editor overflow-x-auto border-b border-border px-3 py-3">
            <pre className="font-mono text-[12px] leading-relaxed text-foreground sm:text-[13px]">
              <span className="mr-3 select-none text-muted-foreground/70">1</span>
              {done ? paintSql(QUERY) : QUERY.slice(0, typed)}
              {!done ? <span className="slab-caret" aria-hidden /> : null}
            </pre>
          </div>

          <div className="min-h-0 flex-1 overflow-x-auto px-3 py-4 sm:px-4">
            {done ? (
              <table className="w-full border-collapse font-mono text-[12px] sm:text-[13px]">
                <thead>
                  <tr className="text-left text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                    <th className="pb-2 pr-3 font-medium">off</th>
                    <th className="pb-2 pr-3 font-medium">id</th>
                    <th className="pb-2 pr-3 font-medium">author</th>
                    <th className="pb-2 font-medium">body</th>
                  </tr>
                </thead>
                <tbody>
                  {ROWS.map((row, i) => (
                    <tr
                      key={row.id}
                      className={
                        i === focus
                          ? "slab-row-live text-foreground"
                          : "text-muted-foreground"
                      }
                    >
                      <td className="py-1.5 pr-3">{row.off}</td>
                      <td className="py-1.5 pr-3">{row.id}</td>
                      <td className="py-1.5 pr-3">{row.author}</td>
                      <td className="py-1.5">{row.body}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="font-mono text-[11px] text-muted-foreground">
                Running
              </p>
            )}
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-border px-3 py-2">
            <p className="flex min-w-0 items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              <span
                className={
                  done
                    ? "size-1.5 shrink-0 rounded-full bg-kiln"
                    : "size-1.5 shrink-0 rounded-full bg-border"
                }
                aria-hidden
              />
              {done ? "2 rows · indexed" : "Parse"}
            </p>
            <p className="hidden min-w-0 truncate font-mono text-[10px] text-muted-foreground sm:block">
              ns=default store=memory cluster=devnet
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
