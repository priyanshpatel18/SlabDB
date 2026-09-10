"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ProfileFields } from "@/components/profile-fields";
import { PublicDataConsent } from "@/components/public-data-consent";
import { useAccount } from "@/hooks/use-account";
import { emptyProfile, type ProfileDraft } from "@/lib/profile";
import { useSlabWallet } from "@/hooks/use-slab-wallet";

export function OnboardingDialog() {
  const { home, profile, funded, save, status } = useAccount();
  const wallet = useSlabWallet();
  const [draft, setDraft] = useState<ProfileDraft>(() => emptyProfile());
  const [busy, setBusy] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const locked = Boolean(funded && home && !profile);

  const onSave = () => {
    if (!agreed) {
      toast.error("Agree to the public data terms to continue");
      return;
    }
    setBusy(true);
    void save(draft)
      .then(() => toast.success("Profile saved"))
      .catch((err) =>
        toast.error(err instanceof Error ? err.message : "Could not save profile")
      )
      .finally(() => setBusy(false));
  };

  return (
    <Dialog open={locked} onOpenChange={() => {}}>
        <DialogContent
        showCloseButton={false}
        className="max-h-[90dvh] overflow-y-auto sm:max-w-lg"
      >
        <DialogHeader>
          <DialogTitle>Set up your profile</DialogTitle>
          <DialogDescription>
            Display name and username are required. Photo and bio are optional.
            The profile is public.
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-5"
          onSubmit={(event) => {
            event.preventDefault();
            onSave();
          }}
        >
          <ProfileFields
            draft={draft}
            onChange={setDraft}
            ownerWallet={wallet.address ?? ""}
          />
          <PublicDataConsent
            id="onboard-public"
            checked={agreed}
            onChange={setAgreed}
          />
          {status ? (
            <p className="text-sm text-muted-foreground" aria-live="polite">
              {status}
            </p>
          ) : null}
          <Button
            type="submit"
            className="h-11 w-full"
            disabled={busy || !agreed || !draft.name.trim() || !draft.uid.trim()}
          >
            {busy ? "Saving" : "Continue"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
