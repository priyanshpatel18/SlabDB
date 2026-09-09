"use client";

import type { ReactNode } from "react";
import { PrivyProvider } from "@privy-io/react-auth";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "next-themes";
import { SlabWalletProvider } from "@/hooks/use-slab-wallet";
import { AgentGuideDialog } from "@/components/agent-guide-dialog";
import {
  PRIVY_ACCENT,
  PRIVY_APP_ID,
  PRIVY_CLIENT_ID,
  privyConfigured,
} from "@/lib/privy-config";

function Inner({ children }: { children: ReactNode }) {
  return (
    <SlabWalletProvider>
      <TooltipProvider>
        {children}
        <AgentGuideDialog />
        <Toaster />
      </TooltipProvider>
    </SlabWalletProvider>
  );
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      forcedTheme="dark"
      defaultTheme="dark"
      enableSystem={false}
    >
      {privyConfigured() ? (
        <PrivyProvider
          appId={PRIVY_APP_ID}
          {...(PRIVY_CLIENT_ID ? { clientId: PRIVY_CLIENT_ID } : {})}
          config={{
            appearance: {
              theme: "dark",
              accentColor: PRIVY_ACCENT,
              logo: "/icon.svg",
              walletChainType: "solana-only",
              showWalletLoginFirst: false,
            },
            loginMethods: ["email", "google"],
            embeddedWallets: {
              showWalletUIs: false,
              ethereum: { createOnLogin: "off" },
              solana: { createOnLogin: "all-users" },
            },
          }}
        >
          <Inner>{children}</Inner>
        </PrivyProvider>
      ) : (
        <Inner>{children}</Inner>
      )}
    </ThemeProvider>
  );
}
