"use client";

import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { WalletDrawer } from "@/components/wallet-drawer";
import { privyConfigured } from "@/lib/privy-config";
import { useSlabWallet } from "@/hooks/use-slab-wallet";

export function WalletButton() {
  const { ready, connected, connecting, address, login } = useSlabWallet();

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
