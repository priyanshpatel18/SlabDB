"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { BookOpen, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Pfp } from "@/components/pfp";
import { ChangelogList } from "@/components/changelog-list";
import { useAccount } from "@/hooks/use-account";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { useSlabWallet } from "@/hooks/use-slab-wallet";
import { HOME_REPO, PROFILE_TABLE, USERS_TABLE, profilePath } from "@/lib/cluster";
import { repoHref } from "@/lib/files";
import { privyConfigured } from "@/lib/privy-config";

export function HomeDashboard() {
  const wallet = useSlabWallet();
  const signerId = wallet.publicKey?.toBase58() ?? "";
  const account = useAccount();
  const home = account.home;
  const error = account.error;
  const boot = account.retry;

  const [query, setQuery] = useState("");
  const [boundId, setBoundId] = useState(signerId);

  if (signerId !== boundId) {
    setBoundId(signerId);
    setQuery("");
  }

  const busy = account.busy;
  const uid = account.profile?.uid ?? "";
  const profileHref = uid ? profilePath(uid) : "/settings";

  const userRepos = useMemo(
    () =>
      (home?.repos ?? []).filter(
        (rel) =>
          rel.name !== HOME_REPO &&
          rel.name !== PROFILE_TABLE &&
          rel.name !== USERS_TABLE
      ),
    [home?.repos]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return userRepos;
    }
    return userRepos.filter((rel) => rel.name.includes(q));
  }, [userRepos, query]);

  const signedOut = !wallet.connected;

  function repoItems() {
    if (filtered.length === 0) {
      return (
        <p className="px-2 py-6 text-center text-sm text-muted-foreground">
          {signedOut
            ? "Sign in to see your repos"
            : userRepos.length
              ? "No repos match that search"
              : "No repos yet"}
        </p>
      );
    }
    return (
      <ul className="flex flex-col gap-0.5">
        {filtered.map((rel) => {
            const href = uid ? repoHref(uid, rel.name) : "";
            const inner = (
              <>
                <BookOpen className="size-3.5 shrink-0 text-kiln" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {uid ? `${uid}/${rel.name}` : rel.name}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {rel.nTuples} {rel.nTuples === 1 ? "file" : "files"}
                  </span>
                </span>
              </>
            );
            return (
              <li key={rel.oid}>
                {href ? (
                  <Link
                    href={href}
                    className="flex min-h-11 items-center gap-3 rounded-md px-2 py-2 hover:bg-sidebar-accent/70 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  >
                    {inner}
                  </Link>
                ) : (
                  <div className="flex min-h-11 items-center gap-3 rounded-md px-2 py-2">
                    {inner}
                  </div>
                )}
              </li>
            );
          })}
      </ul>
    );
  }

  function repoSearch(searchId: string) {
    return (
      <div className="px-2 pb-2">
        <label className="sr-only" htmlFor={searchId}>
          Find a repository
        </label>
        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            id={searchId}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find a repository..."
            className="h-9 pl-8"
            autoComplete="off"
            disabled={signedOut}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-dvh max-w-[100vw] min-h-dvh flex-col overflow-x-hidden bg-background">
      <SiteHeader />
      <div className="flex min-h-0 min-w-0 flex-1">
        <aside className="hidden w-72 shrink-0 flex-col border-r border-border bg-sidebar lg:flex">
          {wallet.connected ? (
            <Link
              href={profileHref}
              className="flex items-center gap-2 border-b border-sidebar-border px-4 py-3 hover:bg-sidebar-accent/70 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <Pfp id={account.profile?.pfp} size={32} />
              <span className="truncate text-sm font-medium">
                {uid || "Profile"}
              </span>
            </Link>
          ) : (
            <div className="flex h-14 items-center border-b border-sidebar-border px-4">
              <p className="truncate text-sm font-medium">Repos</p>
            </div>
          )}
          <div className="flex items-center justify-between gap-2 px-4 pt-4 pb-2">
            <p className="text-xs font-medium text-muted-foreground">
              Top repositories
            </p>
            <Button
              type="button"
              size="sm"
              className="min-h-10 lg:min-h-7"
              nativeButton={false}
              render={<Link href="/new" />}
            >
              <Plus />
              New
            </Button>
          </div>
          {repoSearch("home-search")}
          <ScrollArea className="min-h-0 flex-1 px-2 pb-3">{repoItems()}</ScrollArea>
        </aside>

        <main id="main-content" tabIndex={-1} className="flex min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto">
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
            <div>
              <h1 className="text-2xl font-medium tracking-tight">Home</h1>
              {account.status ? (
                <p className="mt-1 text-sm text-muted-foreground">
                  {account.status}
                </p>
              ) : null}
            </div>

            {!signedOut ? (
              <Link
                href={profileHref}
                className="flex items-center gap-3 lg:hidden"
              >
                <Pfp id={account.profile?.pfp} size={32} />
                <span className="truncate text-sm font-medium">
                  {uid || "Profile"}
                </span>
              </Link>
            ) : null}

            {signedOut ? (
              <Button
                type="button"
                className="h-11 w-full lg:hidden"
                disabled={!wallet.ready || wallet.connecting || !privyConfigured()}
                onClick={() => wallet.login()}
              >
                {wallet.connecting ? "Signing in" : "Sign in"}
              </Button>
            ) : (
              <div className="lg:hidden">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    Top repositories
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    className="min-h-10"
                    nativeButton={false}
                    render={<Link href="/new" />}
                  >
                    <Plus />
                    New
                  </Button>
                </div>
                {repoSearch("home-search-mobile")}
                <div className="px-2 pb-3">{repoItems()}</div>
              </div>
            )}

            {error ? (
              <Alert variant="destructive">
                <AlertTitle>Could not load home</AlertTitle>
                <AlertDescription className="flex flex-col gap-3">
                  <span>{error}</span>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 w-fit"
                    onClick={boot}
                  >
                    Retry
                  </Button>
                </AlertDescription>
              </Alert>
            ) : null}

            {!error && signedOut ? (
              <Empty className="border border-dashed border-border py-12">
                <EmptyHeader>
                  <EmptyTitle>Sign in to open your dashboard</EmptyTitle>
                  <EmptyDescription>
                    Sign in with Privy to see repos for this wallet.
                  </EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <Button
                    type="button"
                    className="h-11 min-w-40"
                    disabled={
                      !wallet.ready || wallet.connecting || !privyConfigured()
                    }
                    onClick={() => {
                      if (!privyConfigured()) {
                        toast.error(
                          "Set NEXT_PUBLIC_PRIVY_APP_ID to enable sign-in"
                        );
                        return;
                      }
                      wallet.login();
                    }}
                  >
                    {wallet.connecting ? "Signing in" : "Sign in"}
                  </Button>
                </EmptyContent>
              </Empty>
            ) : null}

            {!error && !signedOut && !home && busy ? (
              <div className="flex flex-col gap-3" aria-busy="true">
                <Skeleton className="h-8 w-40 motion-reduce:animate-none" />
                <Skeleton className="h-4 w-full motion-reduce:animate-none" />
                <Skeleton className="h-4 w-5/6 motion-reduce:animate-none" />
              </div>
            ) : null}

            {!error && !signedOut && home ? (
              <section>
                <p className="text-sm text-muted-foreground">
                  No recent repo updates
                </p>
              </section>
            ) : null}

            <section className="rounded-lg border border-border bg-card px-4 py-5 lg:hidden">
              <p className="text-sm font-medium">Changelog</p>
              <ChangelogList compact />
            </section>
          </div>
        </main>

        <aside className="hidden w-72 shrink-0 flex-col border-l border-border lg:flex">
          <div className="border-b border-border px-4 py-3">
            <p className="text-sm font-medium">Changelog</p>
          </div>
          <ChangelogList />
        </aside>
      </div>
      <SiteFooter />
    </div>
  );
}
