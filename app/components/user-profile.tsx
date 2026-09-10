"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProfileSidebar } from "@/components/profile-sidebar";
import { ReadmeFile } from "@/components/readme-file";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { useAccount } from "@/hooks/use-account";
import { useUserCatalog } from "@/hooks/use-repo";
import { useSlabWallet } from "@/hooks/use-slab-wallet";
import { HOME_REPO } from "@/lib/cluster";
import { repoHref } from "@/lib/files";
import { loadRepoReadme } from "@/lib/home";
import {
  readPublicCache,
  readReadmeCache,
  writePublicCache,
  writeReadmeCache,
  type CachedPublicProfile,
} from "@/lib/profile-cache";
import { lookupUsername } from "@/lib/username";
import { toast } from "sonner";

export function UserProfile({
  uid,
  initial = null,
}: {
  uid: string;
  initial?: CachedPublicProfile | null;
}) {
  const wallet = useSlabWallet();
  const account = useAccount();
  const catalog = useUserCatalog(uid);
  const home = account.home;
  const [remote, setRemote] = useState<CachedPublicProfile | null>(() => {
    if (initial?.uid === uid) {
      return initial;
    }
    return readPublicCache(uid) ?? initial;
  });
  const [lookupDone, setLookupDone] = useState(() => initial?.uid === uid);
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
    if (initial?.uid === uid) {
      writePublicCache(initial);
      if (initial.readme) {
        writeReadmeCache(uid, initial.readme, initial.wallet);
      }
    }
  }, [initial, uid]);

  useEffect(() => {
    let cancelled = false;
    void lookupUsername(uid)
      .then((row) => {
        if (!cancelled) {
          setRemote((prev) => row ?? prev);
          if (row?.readme) {
            writeReadmeCache(uid, row.readme, row.wallet);
          }
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
          const ownerUid = account.profile?.uid;
          if (ownerUid) {
            writeReadmeCache(ownerUid, body, wallet.address ?? "");
          }
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
  }, [account.profile?.uid, fetchKey, home, wallet.address]);

  const cachedReadme = readReadmeCache(uid);
  const liveReadme =
    own && home && home.active === HOME_REPO
      ? home.readme
      : fetchKey && fetched?.key === fetchKey
        ? fetched.body
        : "";
  const readme =
    liveReadme ||
    remote?.readme ||
    (initial?.uid === uid ? initial.readme : "") ||
    cachedReadme;
  const readmeBusy = Boolean(!readme && fetchKey && fetched?.key !== fetchKey);
  const loading =
    !profile &&
    ((wallet.connected && !account.error && !home && account.busy) ||
      !lookupDone);

  return (
    <div className="flex min-h-dvh max-w-[100vw] flex-col bg-background lg:h-dvh lg:overflow-hidden">
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
        <main id="main-content" tabIndex={-1} className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 lg:flex-row lg:gap-8 lg:py-8">
          <div className="flex items-center gap-4 lg:w-72 lg:shrink-0 lg:flex-col lg:items-stretch">
            <Skeleton className="size-[72px] rounded-full motion-reduce:animate-none lg:size-64" />
            <div className="flex flex-col gap-2">
              <Skeleton className="h-7 w-40 motion-reduce:animate-none" />
              <Skeleton className="h-5 w-28 motion-reduce:animate-none" />
            </div>
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <Skeleton className="h-10 w-full motion-reduce:animate-none" />
            <Skeleton className="h-48 w-full motion-reduce:animate-none" />
          </div>
        </main>
      ) : null}

      {!loading && !profile ? (
        <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-3xl px-4 py-10">
          <Empty className="border border-dashed border-border py-12">
            <EmptyHeader>
              <EmptyTitle>Profile not found</EmptyTitle>
              <EmptyDescription>
                No user has this username.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        </main>
      ) : null}

      {!loading && profile ? (
        <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col lg:min-h-0 lg:flex-row lg:overflow-hidden">
          <aside className="w-full shrink-0 lg:w-80 lg:overflow-y-auto">
            <ProfileSidebar profile={profile} canEdit={own} />
          </aside>
          <main id="main-content" tabIndex={-1} className="flex min-h-0 min-w-0 flex-1 flex-col px-4 pb-8 pt-1 sm:px-6 lg:overflow-hidden lg:py-6">
            {readmeBusy ? (
              <div className="flex flex-col gap-3" aria-busy="true">
                <Skeleton className="h-10 w-full motion-reduce:animate-none" />
                <Skeleton className="h-48 w-full motion-reduce:animate-none" />
              </div>
            ) : (
              <Tabs defaultValue="overview" className="flex min-h-0 flex-1 flex-col lg:overflow-hidden">
                <TabsList variant="line" className="w-full shrink-0 justify-start">
                  <TabsTrigger value="overview" className="min-h-10 px-3">
                    Overview
                  </TabsTrigger>
                  <TabsTrigger value="repos" className="min-h-10 px-3">
                    Repositories
                    {catalog.repos.length
                      ? ` ${catalog.repos.length}`
                      : ""}
                  </TabsTrigger>
                </TabsList>
                <TabsContent
                  value="overview"
                  className="mt-4 min-h-0 flex-1 overflow-y-auto overscroll-contain"
                >
                  {!readme && !own ? (
                    <Empty className="border border-dashed border-border py-10">
                      <EmptyHeader>
                        <EmptyTitle>No README.md</EmptyTitle>
                        <EmptyDescription>
                          This profile has no README.md yet.
                        </EmptyDescription>
                      </EmptyHeader>
                    </Empty>
                  ) : null}
                  {readme || own ? (
                    <ReadmeFile
                      uid={uid}
                      source={readme}
                      canEdit={own && Boolean(home)}
                      status={account.status}
                      onCommit={account.commitReadme}
                    />
                  ) : null}
                </TabsContent>
                <TabsContent
                  value="repos"
                  className="mt-4 min-h-0 flex-1 overflow-y-auto overscroll-contain"
                >
                  {catalog.loading ? (
                    <div className="flex flex-col gap-2" aria-busy="true">
                      <Skeleton className="h-12 w-full motion-reduce:animate-none" />
                      <Skeleton className="h-12 w-full motion-reduce:animate-none" />
                    </div>
                  ) : null}
                  {!catalog.loading && catalog.repos.length === 0 ? (
                    <Empty className="border border-dashed border-border py-10">
                      <EmptyHeader>
                        <EmptyTitle>No repositories</EmptyTitle>
                        <EmptyDescription>
                          {own
                            ? "Create a repository to hold files in folders."
                            : "This user has no public repositories yet."}
                        </EmptyDescription>
                      </EmptyHeader>
                      {own ? (
                        <EmptyContent>
                          <Button
                            type="button"
                            className="h-11"
                            nativeButton={false}
                            render={<Link href="/new" />}
                          >
                            New repository
                          </Button>
                        </EmptyContent>
                      ) : null}
                    </Empty>
                  ) : null}
                  {!catalog.loading && catalog.repos.length > 0 ? (
                    <ul className="flex flex-col gap-2">
                      {catalog.repos.map((rel) => (
                        <li key={rel.oid}>
                          <Link
                            href={repoHref(uid, rel.name)}
                            className="flex min-h-12 items-center gap-3 rounded-lg border border-border bg-card px-3 py-3 hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                          >
                            <BookOpen className="size-4 shrink-0 text-kiln" aria-hidden />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium text-kiln">
                                {uid}/{rel.name}
                              </span>
                              <span className="block truncate text-xs text-muted-foreground">
                                {rel.nTuples} {rel.nTuples === 1 ? "file" : "files"}
                              </span>
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </TabsContent>
              </Tabs>
            )}
          </main>
        </div>
      ) : null}
      <SiteFooter />
    </div>
  );
}
