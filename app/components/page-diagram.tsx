"use client";

import { motion, useReducedMotion } from "motion/react";

const TUPLES = [
  { off: "20", flag: "live", id: "1", author: "ada", body: "first note", live: true, focus: true },
  { off: "48", flag: "live", id: "2", author: "sam", body: "second", live: true, focus: false },
  { off: "70", flag: "dead", id: "3", author: "rio", body: "deleted", live: false, focus: false },
] as const;

export function PageDiagram({ compact = false }: { compact?: boolean }) {
  const reduce = useReducedMotion();

  return (
    <figure className={compact ? undefined : "flex flex-col gap-3"}>
      <div
        className={
          compact
            ? "overflow-x-auto font-mono text-[11px] leading-tight"
            : "overflow-x-auto rounded-lg border border-border bg-card font-mono text-[11px] leading-tight"
        }
      >
        <div className="flex items-baseline justify-between gap-3 border-b border-border px-2.5 py-1.5 text-muted-foreground">
          <span>SLAB v2</span>
          <span>rel 1 · page 0</span>
          <span>8,192 B</span>
        </div>
        <div className="grid grid-cols-[2.5rem_2.75rem_2rem_4.5rem_1fr] gap-x-2 border-b border-border px-2.5 py-1 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
          <span>off</span>
          <span>flag</span>
          <span>id</span>
          <span>author</span>
          <span>body</span>
        </div>
        <ul>
          {TUPLES.map((row, i) => (
            <motion.li
              key={row.off}
              initial={reduce ? false : { opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={
                reduce
                  ? { duration: 0 }
                  : { duration: 0.2, delay: 0.08 + i * 0.04, ease: [0, 0, 0.2, 1] }
              }
              className={
                row.focus
                  ? "grid grid-cols-[2.5rem_2.75rem_2rem_4.5rem_1fr] gap-x-2 bg-kiln/20 px-2.5 py-1.5 text-foreground"
                  : row.live
                    ? "grid grid-cols-[2.5rem_2.75rem_2rem_4.5rem_1fr] gap-x-2 px-2.5 py-1.5 text-foreground"
                    : "grid grid-cols-[2.5rem_2.75rem_2rem_4.5rem_1fr] gap-x-2 px-2.5 py-1.5 text-muted-foreground"
              }
            >
              <span>{row.off}</span>
              <span className={row.live ? "text-kiln" : undefined}>{row.flag}</span>
              <span>{row.id}</span>
              <span>{row.author}</span>
              <span className="truncate">{row.body}</span>
            </motion.li>
          ))}
        </ul>
        <div className="flex items-baseline justify-between gap-3 border-t border-border px-2.5 py-1.5 text-muted-foreground">
          <span>header 32 B</span>
          <span>free 7,994 B</span>
        </div>
      </div>
      {compact ? null : (
        <figcaption className="font-mono text-[11px] leading-relaxed text-muted-foreground">
          8,192-byte Irys page. Live rows stay readable. Deleted rows stay marked
          dead.
        </figcaption>
      )}
    </figure>
  );
}
