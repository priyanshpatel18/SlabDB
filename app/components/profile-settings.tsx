"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { ProfileFields } from "@/components/profile-fields";
import { useAccount } from "@/hooks/use-account";
import { profilePath } from "@/lib/cluster";
import { emptyProfile, type ProfileDraft } from "@/lib/profile";
import { useExportWallet } from "@privy-io/react-auth/solana";
import { useSlabWallet } from "@/hooks/use-slab-wallet";

export function ProfileSettings() {
  const { profile, save, status, home } = useAccount();
  const wallet = useSlabWallet();
  const { exportWallet } = useExportWallet();
  const [draft, setDraft] = useState<ProfileDraft>(() =>
    profile
      ? { ...profile, links: [...profile.links], pfpFile: null }
      : emptyProfile()
  );
  const [boundProfile, setBoundProfile] = useState(profile);
  const [busy, setBusy] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);

  if (profile !== boundProfile) {
    setBoundProfile(profile);
    if (profile) {
      setDraft({ ...profile, links: [...profile.links], pfpFile: null });
    }
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
    <div className="flex h-dvh flex-col bg-background">
      <SiteHeader />
      <main id="main-content" tabIndex={-1} className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-8 sm:px-6">
          <div>
            <h1 className="text-2xl font-medium tracking-tight">
              Public profile
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Stored in your Slab catalog. Photo bytes go to Irys.
            </p>
          </div>
          <ProfileFields
            draft={draft}
            onChange={setDraft}
            extra
            ownerWallet={wallet.address ?? ""}
          />
          {status ? (
            <p className="text-sm text-muted-foreground">{status}</p>
          ) : null}
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              className="h-11 sm:min-w-32"
              disabled={busy || !home}
              onClick={onSave}
            >
              {busy ? "Saving" : "Save"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-11"
              nativeButton={false}
              render={
                <Link
                  href={profile?.uid ? profilePath(profile.uid) : "/"}
                />
              }
            >
              View profile
            </Button>
          </div>
          <section className="border-t border-border pt-6">
            <h2 className="text-sm font-medium">Wallet</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Export the embedded wallet key.
            </p>
            <Button
              type="button"
              variant="outline"
              className="mt-3 h-11"
              disabled={exportBusy || !wallet.address}
              onClick={() => {
                if (!wallet.address) {
                  return;
                }
                setExportBusy(true);
                void exportWallet({ address: wallet.address })
                  .catch((err) =>
                    toast.error(
                      err instanceof Error ? err.message : "Could not export wallet"
                    )
                  )
                  .finally(() => setExportBusy(false));
              }}
            >
              {exportBusy ? "Opening export" : "Export wallet"}
            </Button>
          </section>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
