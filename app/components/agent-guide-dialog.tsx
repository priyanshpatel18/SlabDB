"use client";

import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useSlabWallet } from "@/hooks/use-slab-wallet";

const DISMISS_KEY = "slab-agent-guide";

function dismissed(): boolean {
  try {
    return sessionStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

function rememberDismiss(): void {
  try {
    sessionStorage.setItem(DISMISS_KEY, "1");
  } catch {
    return;
  }
}

export function AgentGuideDialog() {
  const { ready, connected, agentAvailable, agentEnabled, enableAgent } =
    useSlabWallet();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready || !connected || !agentAvailable || agentEnabled || dismissed()) {
      return;
    }
    const timer = window.setTimeout(() => setOpen(true), 400);
    return () => window.clearTimeout(timer);
  }, [agentAvailable, agentEnabled, connected, ready]);

  const closeForNow = () => {
    rememberDismiss();
    setOpen(false);
    setError(null);
  };

  const onEnable = () => {
    setBusy(true);
    setError(null);
    void enableAgent()
      .then(() => {
        rememberDismiss();
        setOpen(false);
      })
      .catch((err) => {
        const message =
          err instanceof Error ? err.message : "Could not enable agent";
        setError(message);
        toast.error(message);
      })
      .finally(() => setBusy(false));
  };

  if (!agentAvailable || agentEnabled) {
    return null;
  }

  return (
    <Dialog
      open={open && !agentEnabled}
      onOpenChange={(next) => {
        if (!next) closeForNow();
      }}
    >
      <DialogContent className="sm:max-w-md" showCloseButton>
        <DialogHeader>
          <DialogTitle>Enable the agent signer</DialogTitle>
          <DialogDescription>
            SQL writes can then sign without a wallet popup. You own this
            wallet. The app key is a second signer.
          </DialogDescription>
        </DialogHeader>
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        <DialogFooter className="sm:justify-end">
          <Button
            variant="outline"
            className="min-h-10 sm:min-h-8"
            disabled={busy}
            onClick={closeForNow}
          >
            Later
          </Button>
          <Button
            className="min-h-10 sm:min-h-8"
            disabled={busy}
            aria-busy={busy}
            onClick={onEnable}
          >
            <ShieldCheck data-icon="inline-start" />
            {busy ? "Enabling agent" : "Enable agent"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
