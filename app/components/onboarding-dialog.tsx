"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ProfileFields } from "@/components/profile-fields";
import { useAccount } from "@/hooks/use-account";
import { emptyProfile, type ProfileDraft } from "@/lib/profile";
import { useSlabWallet } from "@/hooks/use-slab-wallet";

export function OnboardingDialog() {
  const { home, profile, funded, save, status } = useAccount();
  const wallet = useSlabWallet();
  const [draft, setDraft] = useState<ProfileDraft>(() => emptyProfile());
  const [busy, setBusy] = useState(false);
  const locked = Boolean(funded && home && !profile);

  if (!locked) {
    return null;
  }

  const onSave = () => {
    setBusy(true);
    void save(draft)
      .then(() => toast.success("Profile saved"))
      .catch((err) =>
        toast.error(err instanceof Error ? err.message : "Could not save profile")
      )
      .finally(() => setBusy(false));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 px-4">
      <div className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-lg border border-border bg-card p-6">
        <h2 className="text-lg font-medium">Set up your profile</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Display name and username are required. Photo and bio are optional.
        </p>
        <div className="mt-5">
          <ProfileFields
            draft={draft}
            onChange={setDraft}
            ownerWallet={wallet.address ?? ""}
          />
        </div>
        {status ? (
          <p className="mt-3 text-sm text-muted-foreground">{status}</p>
        ) : null}
        <Button
          type="button"
          className="mt-5 h-11 w-full"
          disabled={busy || !draft.name.trim() || !draft.uid.trim()}
          onClick={onSave}
        >
          {busy ? "Saving" : "Continue"}
        </Button>
      </div>
    </div>
  );
}
