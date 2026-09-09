import Link from "next/link";
import { WalletButton } from "@/components/wallet-button";

export function SiteHeader() {
  return (
    <header className="relative z-20 border-b border-border pt-[env(safe-area-inset-top)]">
      <div className="flex h-14 w-full min-w-0 items-center justify-between gap-3 px-4">
        <Link
          href="/"
          className="shrink-0 text-xl font-semibold tracking-tight"
        >
          Slab
        </Link>
        <nav className="flex min-w-0 items-center gap-3 sm:gap-4">
          <Link
            href="/docs"
            className="shrink-0 text-sm text-muted-foreground hover:text-foreground"
          >
            Docs
          </Link>
            <Link
              href="/console"
              className="hidden shrink-0 text-sm text-muted-foreground hover:text-foreground sm:inline"
            >
              Console
            </Link>
          <WalletButton />
        </nav>
      </div>
    </header>
  );
}
