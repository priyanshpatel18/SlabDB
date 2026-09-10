"use client";

import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { WalletDrawer } from "@/components/wallet-drawer";
import { privyConfigured } from "@/lib/privy-config";
import { useSlabWallet } from "@/hooks/use-slab-wallet";
import { isSessionPending } from "@/lib/wallet";

export function WalletButton() {
  const wallet = useSlabWallet();
  const { ready, connected, connecting, address, login } = wallet;

  if (!privyConfigured()) {
    return (
      <Button
        size="sm"
        variant="outline"
        className="min-h-10 shrink-0 sm:min-h-7"
        onClick={() =>
          toast.error("Set NEXT_PUBLIC_PRIVY_APP_ID to enable sign-in")
        }
      >
        Sign in
      </Button>
    );
  }

  if (connected && address) {
    return <WalletDrawer />;
  }

  if (isSessionPending(wallet)) {
    return (
      <span
        className="inline-flex size-8 shrink-0 items-center justify-center"
        aria-busy="true"
        aria-label="Restoring session"
      >
        <Skeleton className="size-8 rounded-full motion-reduce:animate-none" />
      </span>
    );
  }

  return (
    <Button
      size="sm"
      className="min-h-10 shrink-0 sm:min-h-7"
      disabled={!ready || connecting}
      aria-busy={connecting}
      onClick={() => login()}
    >
      {connecting ? "Signing in" : "Sign in"}
    </Button>
  );
}
