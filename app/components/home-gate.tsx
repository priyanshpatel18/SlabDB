"use client";

import { HomeDashboard } from "@/components/home-dashboard";
import { SiteHeader } from "@/components/site-header";
import { Skeleton } from "@/components/ui/skeleton";
import { useSlabWallet } from "@/hooks/use-slab-wallet";

function HomeBoot() {
  return (
    <div className="flex h-dvh flex-col bg-background">
      <SiteHeader />
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-10">
        <Skeleton className="h-8 w-32 motion-reduce:animate-none" />
        <Skeleton className="h-12 w-full motion-reduce:animate-none" />
        <Skeleton className="h-48 w-full motion-reduce:animate-none" />
      </div>
    </div>
  );
}

export function HomeGate() {
  const wallet = useSlabWallet();

  if (wallet.authenticated && (!wallet.ready || !wallet.connected)) {
    return <HomeBoot />;
  }
  return <HomeDashboard />;
}
