"use client";

import { useMemo, type ReactNode } from "react";
import {
  WalletAdapterNetwork,
  WalletNotReadyError,
  type Adapter,
} from "@solana/wallet-adapter-base";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { SolflareWalletAdapter } from "@solana/wallet-adapter-solflare";
import {
  SolanaMobileWalletAdapter,
  createDefaultAddressSelector,
  createDefaultAuthorizationResultCache,
  createDefaultWalletNotFoundHandler,
} from "@solana-mobile/wallet-adapter-mobile";
import { toast } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "next-themes";
import { BASE_RPC_URL, CLUSTER } from "@/lib/cluster";

function makeWallets() {
  const wallets: Adapter[] = [
    new PhantomWalletAdapter(),
    new SolflareWalletAdapter({ network: WalletAdapterNetwork.Devnet }),
  ];

  if (typeof window === "undefined") return wallets;

  wallets.unshift(
    new SolanaMobileWalletAdapter({
      addressSelector: createDefaultAddressSelector(),
      appIdentity: {
        name: "Slab",
        uri: window.location.origin,
        icon: "/icon.svg",
      },
      authorizationResultCache: createDefaultAuthorizationResultCache(),
      cluster: CLUSTER,
      onWalletNotFound: createDefaultWalletNotFoundHandler(),
    }),
  );

  return wallets;
}

export function Providers({ children }: { children: ReactNode }) {
  const wallets = useMemo(() => makeWallets(), []);

  return (
    <ThemeProvider
      attribute="class"
      forcedTheme="dark"
      defaultTheme="dark"
      enableSystem={false}
    >
      <ConnectionProvider endpoint={BASE_RPC_URL}>
        <WalletProvider
          wallets={wallets}
          autoConnect
          onError={(error) => {
            if (error instanceof WalletNotReadyError) return;
            toast.error(error.message);
          }}
        >
          <TooltipProvider>
            {children}
            <Toaster />
          </TooltipProvider>
        </WalletProvider>
      </ConnectionProvider>
    </ThemeProvider>
  );
}
