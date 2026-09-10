"use client";

import { Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
      <Dialog open={locked && Boolean(address)} onOpenChange={() => {}}>
        <DialogContent showCloseButton={false} className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Fund this wallet</DialogTitle>
            <DialogDescription>
              Send SOL to the embedded wallet. The app stays locked until the
              balance is above zero. The faucet is a third-party Solana site.
            </DialogDescription>
          </DialogHeader>
          {address ? (
            <>
              <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
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
                  <Copy aria-hidden />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {shortAddr(address)} · {sol == null ? "—" : `${formatSol(sol)} SOL`}
              </p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  type="button"
                  className="h-11 min-w-0 flex-1"
                  nativeButton={false}
                  render={
                    <a
                      href={SOL_FAUCET_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                    />
                  }
                >
                  Open faucet
                  <span className="sr-only"> (opens in a new tab)</span>
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
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
