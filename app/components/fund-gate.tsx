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
import { CLUSTER, SOL_FAUCET_URL, shortAddr } from "@/lib/cluster";
import {
  MIN_ACCOUNT_SOL,
  remainingAccountSol,
} from "@/lib/account-fund";
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
  const { solLamports, funded, refreshSol } = useAccount();
  const locked = Boolean(wallet.connected && solLamports != null && !funded);
  const sol = solAmount(solLamports);
  const address = wallet.address;
  const stillNeed = remainingAccountSol(solLamports);

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
      <Dialog
        open={locked && Boolean(address)}
        disablePointerDismissal
        onOpenChange={() => {}}
      >
        <DialogContent
          showCloseButton={false}
          className="max-h-[90dvh] overflow-y-auto sm:max-w-lg"
        >
          <DialogHeader>
            <DialogTitle>Add {MIN_ACCOUNT_SOL} SOL to continue</DialogTitle>
            <DialogDescription>
              You signed in, so Slab created an embedded Solana wallet. You must
              send at least {MIN_ACCOUNT_SOL} SOL to that wallet before you can
              create a profile or a repository. This SOL pays Solana and Irys
              network fees. Slab does not take it as a product fee.
            </DialogDescription>
          </DialogHeader>
          {address ? (
            <>
              <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed text-foreground">
                <li>Copy the embedded wallet address below.</li>
                <li>
                  Open the Solana faucet. It is a third-party site. Choose the{" "}
                  {CLUSTER} cluster.
                </li>
                <li>
                  Paste the address and request at least {MIN_ACCOUNT_SOL} SOL.
                  If the faucet sends 1 SOL, request again until the balance is{" "}
                  {MIN_ACCOUNT_SOL} SOL.
                </li>
                <li>
                  Return here. This screen stays open until the balance is{" "}
                  {MIN_ACCOUNT_SOL} SOL or more. We check every few seconds.
                </li>
              </ol>
              <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
                <p className="min-w-0 flex-1 break-all font-mono text-sm">
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
              <p className="text-sm text-foreground" aria-live="polite">
                Balance:{" "}
                {sol == null ? "checking" : `${formatSol(sol)} SOL`} of{" "}
                {MIN_ACCOUNT_SOL} SOL.
                {sol != null && stillNeed > 0
                  ? ` Still need ${formatSol(stillNeed)} SOL.`
                  : ""}
              </p>
              <p className="text-xs text-muted-foreground">
                {shortAddr(address)} on Solana {CLUSTER}.
              </p>
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
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
                  onClick={() => refreshSol()}
                >
                  Check balance
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
