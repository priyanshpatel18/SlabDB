"use client";

import { useMemo, useState } from "react";
import { WalletReadyState } from "@solana/wallet-adapter-base";
import { useWallet } from "@solana/wallet-adapter-react";
import { SolanaMobileWalletAdapterWalletName } from "@solana-mobile/wallet-adapter-mobile";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { explorerAddressUrl, shortAddr } from "@/lib/cluster";

const READY_ORDER: Record<WalletReadyState, number> = {
  [WalletReadyState.Installed]: 0,
  [WalletReadyState.Loadable]: 1,
  [WalletReadyState.NotDetected]: 2,
  [WalletReadyState.Unsupported]: 3,
};

function walletLabel(name: string) {
  if (name === SolanaMobileWalletAdapterWalletName) return "Mobile wallet";
  return name;
}

function readyHint(state: WalletReadyState) {
  if (state === WalletReadyState.Installed) return "Ready";
  if (state === WalletReadyState.Loadable) return "Open";
  if (state === WalletReadyState.NotDetected) return "Install";
  return "";
}

export function WalletButton() {
  const {
    wallets,
    select,
    publicKey,
    connected,
    connecting,
    disconnect,
    wallet,
  } = useWallet();
  const [open, setOpen] = useState(false);
  const address = publicKey?.toBase58();

  const listed = useMemo(
    () =>
      wallets
        .filter((w) => w.readyState !== WalletReadyState.Unsupported)
        .slice()
        .sort((a, b) => {
          const rank =
            (READY_ORDER[a.readyState] ?? 9) - (READY_ORDER[b.readyState] ?? 9);
          if (rank !== 0) return rank;
          if (a.adapter.name === SolanaMobileWalletAdapterWalletName) return -1;
          if (b.adapter.name === SolanaMobileWalletAdapterWalletName) return 1;
          return a.adapter.name.localeCompare(b.adapter.name);
        }),
    [wallets],
  );

  if (connected && address) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="outline"
              size="sm"
              className="min-h-10 shrink-0 font-mono sm:min-h-7"
            />
          }
        >
          <span
            className="size-1.5 shrink-0 rounded-full bg-kiln"
            aria-hidden
          />
          {shortAddr(address)}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuGroup>
            <DropdownMenuItem
              onClick={() => {
                void navigator.clipboard.writeText(address).then(
                  () => toast.success("Copied"),
                  () => toast.error("Could not copy"),
                );
              }}
            >
              Copy address
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                window.open(explorerAddressUrl(address), "_blank", "noopener");
              }}
            >
              View on explorer
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => {
                void disconnect();
              }}
            >
              Disconnect
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <>
      <Button
        size="sm"
        className="min-h-10 shrink-0 sm:min-h-7"
        disabled={connecting}
        aria-busy={connecting}
        onClick={() => setOpen(true)}
      >
        {connecting ? "Connecting" : (
          <>
            <span className="sm:hidden">Connect</span>
            <span className="hidden sm:inline">Connect Wallet</span>
          </>
        )}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-[var(--radius)] sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Connect wallet</DialogTitle>
            <DialogDescription>
              Sign writes from this browser. Android Chrome uses Mobile Wallet
              Adapter. Other phones open your wallet app.
            </DialogDescription>
          </DialogHeader>
          {listed.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No wallets detected. Install Phantom or Solflare, or open this
              page in a wallet browser.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {listed.map((item) => {
                const selected = wallet?.adapter.name === item.adapter.name;
                return (
                  <li key={item.adapter.name}>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-auto min-h-11 w-full justify-start gap-3 px-3 py-2"
                      disabled={connecting}
                      aria-busy={connecting && selected}
                      onClick={() => {
                        select(item.adapter.name);
                        setOpen(false);
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={item.adapter.icon}
                        alt=""
                        width={20}
                        height={20}
                        className="size-5 shrink-0"
                      />
                      <span className="flex-1 text-left">
                        {walletLabel(item.adapter.name)}
                      </span>
                      <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                        {connecting && selected
                          ? "Connecting"
                          : readyHint(item.readyState)}
                      </span>
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
