"use client";

import { HomeDashboard } from "@/components/home-dashboard";
import { SiteHeader } from "@/components/site-header";
import { Skeleton } from "@/components/ui/skeleton";
import { useSlabWallet } from "@/hooks/use-slab-wallet";
import { privyConfigured } from "@/lib/privy-config";
import { isSessionPending } from "@/lib/wallet";

function HomeBoot() {
  return (
    <div className="flex h-dvh flex-col bg-background">
      <SiteHeader />
      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-10"
        aria-busy="true"
        aria-label="Loading home"
      >
        <Skeleton className="h-8 w-32 motion-reduce:animate-none" />
        <Skeleton className="h-12 w-full motion-reduce:animate-none" />
        <Skeleton className="h-48 w-full motion-reduce:animate-none" />
      </main>
    </div>
  );
}

export function HomeGate() {
  const wallet = useSlabWallet();

  if (privyConfigured() && isSessionPending(wallet) && !wallet.connected) {
    return <HomeBoot />;
  }
  return <HomeDashboard />;
}
