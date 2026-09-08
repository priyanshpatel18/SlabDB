import Link from "next/link";
import { WalletButton } from "@/components/wallet-button";

export function SiteHeader() {
  return (
    <header className="relative z-20 border-b border-border pt-[env(safe-area-inset-top)]">
      <div className="flex h-14 w-full min-w-0 items-center justify-between gap-3 px-4 sm:px-6 lg:px-10 xl:px-14">
        <Link
          href="/"
          className="shrink-0 font-display text-[1.5rem] italic leading-none tracking-tight sm:text-[1.65rem]"
        >
          Slab
        </Link>
        <nav className="flex min-w-0 items-center gap-3 sm:gap-4">
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
