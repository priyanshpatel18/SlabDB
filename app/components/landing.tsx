import Link from "next/link";
import { QueryStage } from "@/components/query-stage";
import { SiteHeader } from "@/components/site-header";

export function Landing() {
  return (
    <div className="flex h-dvh max-w-[100vw] min-h-dvh flex-col overflow-x-hidden bg-background max-md:h-auto max-md:overflow-y-auto">
      <SiteHeader />

      <main className="flex min-h-0 min-w-0 flex-1 flex-col lg:flex-row">
        <section className="flex w-full flex-col justify-start px-4 py-8 sm:px-6 lg:w-[40%] lg:px-10 lg:pt-[clamp(4.5rem,18vh,8.5rem)] lg:pb-10 xl:px-14">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground sm:text-[11px] sm:tracking-[0.22em]">
            Onchain database infrastructure
          </p>
          <h1 className="mt-4 text-[2rem] font-normal leading-[1.1] tracking-[-0.03em] text-foreground sm:text-5xl lg:text-[3.25rem] xl:text-[3.45rem]">
            SQL-native <span className="slab-word">storage</span>. Built for
            onchain execution.
          </h1>
          <p className="mt-6 max-w-[34rem] text-[0.95rem] leading-relaxed text-pretty text-muted-foreground sm:text-base">
            Slab indexes structured data on MagicBlock and persists table pages
            to Irys. The console runs the v0 subset in this browser.
          </p>
          <div className="mt-8">
            <Link href="/console" className="slab-cta">
              Open console
              <span className="slab-cta-arrow" aria-hidden>
                →
              </span>
            </Link>
          </div>
        </section>

        <section className="product-well relative flex min-h-[22rem] min-w-0 w-full flex-1 flex-col items-center justify-center p-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:min-h-[26rem] sm:p-8 lg:min-h-0 lg:px-14 lg:py-12 lg:pb-12">
          <OffsetMarks />
          <WellActivity />
          <GhostPages />
          <div className="relative z-10 w-full min-w-0 max-w-[40rem] lg:max-w-[42rem]">
            <QueryStage />
          </div>
        </section>
      </main>
    </div>
  );
}

function OffsetMarks() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-y-6 left-2 z-0 hidden flex-col justify-between font-mono text-[10px] text-muted-foreground/30 xl:flex"
    >
      <span>0x0000</span>
      <span>0x1000</span>
      <span>0x2000</span>
    </div>
  );
}

function WellActivity() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
    >
      <div className="slab-scan" />
    </div>
  );
}

const GHOST = [
  ["00002", "0x1800", "22%"],
  ["00003", "0x2000", "41%"],
  ["00004", "0x2800", "9%"],
] as const;

function GhostPages() {
  return (
    <ol
      aria-hidden
      className="pointer-events-none absolute top-6 right-1 bottom-6 z-0 hidden w-[3.15rem] flex-col justify-between xl:flex"
    >
      {GHOST.map(([page, off, fill]) => (
        <li key={page} className="text-muted-foreground/50">
          <p className="font-mono text-[9px] uppercase tracking-[0.1em]">
            {page}
          </p>
          <p className="mt-0.5 font-mono text-[9px]">{off}</p>
          <div className="mt-1.5 h-px bg-border/50">
            <div className="h-full bg-kiln/35" style={{ width: fill }} />
          </div>
        </li>
      ))}
    </ol>
  );
}
