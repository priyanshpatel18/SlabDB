import Link from "next/link";
import { BrandLockup } from "@/components/brand-lockup";
import { WalletButton } from "@/components/wallet-button";

export function SiteHeader() {
  return (
    <header className="relative z-20 border-b border-border pt-[env(safe-area-inset-top)]">
      <div className="flex h-14 w-full min-w-0 items-center justify-between gap-3 px-4">
        <Link href="/" aria-label="Slab" className="shrink-0">
          <BrandLockup priority />
        </Link>
        <nav aria-label="Site" className="flex min-w-0 items-center gap-3 sm:gap-4">
          <Link
            href="/new"
            className="inline-flex min-h-10 shrink-0 items-center text-sm text-muted-foreground hover:text-foreground focus-visible:text-foreground sm:min-h-7"
          >
            New
          </Link>
          <Link
            href="/docs"
            className="inline-flex min-h-10 shrink-0 items-center text-sm text-muted-foreground hover:text-foreground focus-visible:text-foreground sm:min-h-7"
          >
            Docs
          </Link>
          <Link
            href="/console"
            className="hidden min-h-10 shrink-0 items-center text-sm text-muted-foreground hover:text-foreground focus-visible:text-foreground sm:inline-flex sm:min-h-7"
          >
            Console
          </Link>
          <WalletButton />
        </nav>
      </div>
    </header>
  );
}
