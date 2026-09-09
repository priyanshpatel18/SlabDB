"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { DocsProse } from "@/components/docs-prose";
import { ProfileSidebar } from "@/components/profile-sidebar";
import { SiteHeader } from "@/components/site-header";
import { useAccount } from "@/hooks/use-account";
import { useSlabWallet } from "@/hooks/use-slab-wallet";
import { HOME_REPO, README_PATH } from "@/lib/cluster";
import { loadRepoReadme } from "@/lib/home";
import { readPublicCache, type CachedPublicProfile } from "@/lib/profile-cache";
import { lookupUsername } from "@/lib/username";
import { toast } from "sonner";

export function UserProfile({ uid }: { uid: string }) {
  const wallet = useSlabWallet();
  const account = useAccount();
  const home = account.home;
  const [remote, setRemote] = useState<CachedPublicProfile | null>(() =>
    readPublicCache(uid)
  );
  const [lookupDone, setLookupDone] = useState(false);
  const [fetched, setFetched] = useState<{ key: string; body: string } | null>(
    null
  );

  const own = Boolean(
    (account.profile?.uid && account.profile.uid === uid) ||
      (wallet.address && remote?.wallet === wallet.address)
  );
  const profile = own && account.profile?.uid === uid ? account.profile : remote;
  const fetchKey =
    own && home && home.active !== HOME_REPO ? home.session.slab : "";

  useEffect(() => {
    let cancelled = false;
    void lookupUsername(uid)
      .then((row) => {
        if (!cancelled) {
          setRemote(row);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLookupDone(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [uid]);

  useEffect(() => {
    if (!fetchKey || !home) {
      return;
    }
    let cancelled = false;
    void loadRepoReadme(home.session, HOME_REPO)
      .then((body) => {
        if (!cancelled) {
          setFetched({ key: fetchKey, body });
        }
      })
      .catch((err) => {
        if (!cancelled) {
          toast.error(
            err instanceof Error ? err.message : "Could not load README"
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [fetchKey, home]);

  const readme =
    own && home && home.active === HOME_REPO
      ? home.readme
      : fetchKey && fetched?.key === fetchKey
        ? fetched.body
        : (remote?.readme ?? "");
  const readmeBusy = Boolean(fetchKey && fetched?.key !== fetchKey);
  const loading =
    !profile &&
    ((wallet.connected && !account.error && !home && account.busy) ||
      !lookupDone);

  return (
    <div className="flex h-dvh max-w-[100vw] min-h-dvh flex-col overflow-x-hidden bg-background">
      <SiteHeader />
      {account.error && own ? (
        <div className="mx-auto w-full max-w-3xl px-4 py-8">
          <Alert variant="destructive">
            <AlertTitle>Could not load profile</AlertTitle>
            <AlertDescription className="flex flex-col gap-3">
              <span>{account.error}</span>
              <Button
                type="button"
                variant="outline"
                className="h-11 w-fit"
                onClick={account.retry}
              >
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        </div>
      ) : null}

      {loading ? (
        <div className="mx-auto flex w-full max-w-5xl gap-8 px-4 py-8">
          <div className="hidden w-72 shrink-0 flex-col gap-3 lg:flex">
            <Skeleton className="size-64 rounded-full motion-reduce:animate-none" />
            <Skeleton className="h-8 w-40 motion-reduce:animate-none" />
            <Skeleton className="h-4 w-28 motion-reduce:animate-none" />
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <Skeleton className="h-10 w-full motion-reduce:animate-none" />
            <Skeleton className="h-48 w-full motion-reduce:animate-none" />
          </div>
        </div>
      ) : null}

      {!loading && !profile ? (
        <div className="mx-auto w-full max-w-3xl px-4 py-10">
          <Empty className="border border-dashed border-border py-12">
            <EmptyHeader>
              <EmptyTitle>Profile not found</EmptyTitle>
              <EmptyDescription>
                No user has this username.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        </div>
      ) : null}

      {!loading && profile ? (
        <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col overflow-y-auto lg:flex-row">
          <aside className="w-full shrink-0 lg:w-80">
            <ProfileSidebar profile={profile} canEdit={own} />
          </aside>
          <main className="min-w-0 flex-1 px-4 py-6 sm:px-6">
            {readmeBusy ? (
              <div className="flex flex-col gap-3" aria-busy="true">
                <Skeleton className="h-10 w-full motion-reduce:animate-none" />
                <Skeleton className="h-48 w-full motion-reduce:animate-none" />
              </div>
            ) : null}
            {!readmeBusy && !readme ? (
              <Empty className="border border-dashed border-border py-10">
                <EmptyHeader>
                  <EmptyTitle>No README.md</EmptyTitle>
                  <EmptyDescription>
                    This profile has no README.md yet.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : null}
            {!readmeBusy && readme ? (
              <section className="overflow-hidden rounded-lg border border-border bg-card">
                <div className="border-b border-border px-4 py-2.5">
                  <p className="truncate font-mono text-sm">
                    {uid} / {README_PATH}
                  </p>
                </div>
                <div className="px-4 py-6 sm:px-6">
                  <DocsProse source={readme} variant="readme" />
                </div>
              </section>
            ) : null}
          </main>
        </div>
      ) : null}
    </div>
  );
}
