"use client";

import { Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SOL_FAUCET_URL, shortAddr } from "@/lib/cluster";
import { useSlabWallet } from "@/hooks/use-slab-wallet";
import { useAccount, solAmount } from "@/hooks/use-account";
import { formatSol } from "@/lib/wallet-holdings";

function copyText(value: string) {
  void navigator.clipboard.writeText(value).then(
    () => toast.success("Copied"),
    () => toast.error("Could not copy")
  );
}

export function FundGate({ children }: { children: React.ReactNode }) {
  const wallet = useSlabWallet();
  const { solLamports, funded } = useAccount();
  const locked = Boolean(wallet.connected && solLamports != null && !funded);
  const sol = solAmount(solLamports);
  const address = wallet.address;

  return (
    <div className="relative min-h-dvh">
      <div
        className={
          locked
            ? "pointer-events-none select-none blur-md"
            : undefined
        }
        aria-hidden={locked}
      >
        {children}
      </div>
      {locked && address ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/40 px-4">
          <div className="w-full max-w-md rounded-lg border border-border bg-card p-6">
            <h2 className="text-lg font-medium">Fund this wallet</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Send SOL to the embedded wallet. The app stays locked until the
              balance is above zero.
            </p>
            <div className="mt-4 flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
              <p className="min-w-0 flex-1 truncate font-mono text-sm">
                {address}
              </p>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="min-h-10 min-w-10 sm:min-h-8 sm:min-w-8"
                aria-label="Copy address"
                onClick={() => copyText(address)}
              >
                <Copy />
              </Button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {shortAddr(address)} · {sol == null ? "—" : `${formatSol(sol)} SOL`}
            </p>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                className="h-11 min-w-0 flex-1"
                nativeButton={false}
                render={
                  <a href={SOL_FAUCET_URL} target="_blank" rel="noreferrer" />
                }
              >
                Open faucet
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-11 min-w-0 flex-1"
                onClick={() => {
                  void wallet.logout();
                }}
              >
                Sign out
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
