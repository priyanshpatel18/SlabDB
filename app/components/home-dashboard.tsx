"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpen, FileText, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DocsProse } from "@/components/docs-prose";
import { SiteHeader } from "@/components/site-header";
import { useSlabWallet } from "@/hooks/use-slab-wallet";
import type { SlabSigner } from "@/lib/wallet";
import { CHANGELOG } from "@/lib/changelog";
import { HOME_REPO, README_PATH, shortAddr } from "@/lib/cluster";
import { privyConfigured } from "@/lib/privy-config";
import {
  createRepo,
  loadRepoReadme,
  openHome,
  type HomeState,
} from "@/lib/home";

function asSigner(
  wallet: ReturnType<typeof useSlabWallet>
): SlabSigner | null {
  if (!wallet.publicKey || !wallet.connected) {
    return null;
  }
  return {
    publicKey: wallet.publicKey,
    signTransaction: wallet.signTransaction,
    signAllTransactions: wallet.signAllTransactions,
    signMessage: wallet.signMessage,
  };
}

function ChangelogList({ compact }: { compact?: boolean }) {
  if (CHANGELOG.length === 0) {
    return (
      <p
        className={
          compact
            ? "mt-2 text-sm text-muted-foreground"
            : "px-4 py-6 text-sm text-muted-foreground"
        }
      >
        There is no changelog.
      </p>
    );
  }
  return (
    <ol className={compact ? "mt-2 flex flex-col gap-1" : "flex flex-col gap-1 p-3"}>
      {CHANGELOG.map((item) => (
        <li key={item.title}>
          <Link
            href={item.href}
            className="block rounded-md px-2 py-3 text-sm text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            {item.title}
          </Link>
        </li>
      ))}
    </ol>
  );
}

export function HomeDashboard() {
  const wallet = useSlabWallet();
  const router = useRouter();
  const signer = useMemo(() => asSigner(wallet), [wallet]);
  const signerId = signer?.publicKey.toBase58() ?? "";

  const [home, setHome] = useState<HomeState | null>(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [boundId, setBoundId] = useState(signerId);

  if (signerId !== boundId) {
    setBoundId(signerId);
    setHome(null);
    setError(null);
    setQuery("");
  }

  const boot = useCallback(() => {
    if (!signer) {
      return;
    }
    setBusy(true);
    setError(null);
    setStatus("Opening home");
    void openHome(signer, setStatus)
      .then((next) => {
        setHome(next);
        setStatus("");
      })
      .catch((err) => {
        setHome(null);
        setError(err instanceof Error ? err.message : "Could not open home");
      })
      .finally(() => setBusy(false));
  }, [signer]);

  useEffect(() => {
    if (!signer) {
      return;
    }
    let cancelled = false;
    setBusy(true);
    setError(null);
    setStatus("Opening home");
    void openHome(signer, (msg) => {
      if (!cancelled) {
        setStatus(msg);
      }
    })
      .then((next) => {
        if (cancelled) {
          return;
        }
        setHome(next);
        setStatus("");
      })
      .catch((err) => {
        if (cancelled) {
          return;
        }
        setHome(null);
        setError(err instanceof Error ? err.message : "Could not open home");
      })
      .finally(() => {
        if (!cancelled) {
          setBusy(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [signer]);

  const userRepos = useMemo(
    () => (home?.repos ?? []).filter((rel) => rel.name !== HOME_REPO),
    [home?.repos]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return userRepos;
    }
    return userRepos.filter((rel) => rel.name.includes(q));
  }, [userRepos, query]);

  const selectRepo = useCallback(
    (name: string) => {
      if (!home || name === home.active) {
        return;
      }
      setBusy(true);
      setError(null);
      void loadRepoReadme(home.session, name)
        .then((readme) => {
          setHome({ ...home, active: name, readme });
        })
        .catch((err) => {
          setError(err instanceof Error ? err.message : "Could not load README");
        })
        .finally(() => setBusy(false));
    },
    [home]
  );

  const onCreate = useCallback(() => {
    if (!home || !signer) {
      return;
    }
    setBusy(true);
    setError(null);
    void createRepo(home.session, newName, signer.publicKey.toBase58(), setStatus)
      .then((next) => {
        setHome(next);
        setNewOpen(false);
        setNewName("");
        toast.success(`Created ${next.active}`);
      })
      .catch((err) => {
        const msg = err instanceof Error ? err.message : "Could not create repo";
        setError(msg);
        toast.error(msg);
      })
      .finally(() => {
        setBusy(false);
        setStatus("");
      });
  }, [home, newName, signer]);

  const tenant = signer ? shortAddr(signer.publicKey.toBase58()) : "Repos";
  const canRun = Boolean(home) && !busy;
  const signedOut = !wallet.connected;
  const subtitle = signedOut
    ? "Sign in to open your wallet homepage."
    : status;

  return (
    <div className="flex h-dvh max-w-[100vw] min-h-dvh flex-col overflow-x-hidden bg-background">
      <SiteHeader />
      <div className="flex min-h-0 min-w-0 flex-1">
        <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-sidebar lg:flex">
          <div className="flex h-14 items-center justify-between gap-2 border-b border-sidebar-border px-4">
            <p className="truncate text-sm font-medium">{tenant || "Repos"}</p>
            <Button
              type="button"
              size="sm"
              className="min-h-10 lg:min-h-7"
              disabled={!canRun}
              onClick={() => setNewOpen(true)}
            >
              <Plus />
              New
            </Button>
          </div>
          <p className="px-4 pt-4 pb-2 text-xs font-medium text-muted-foreground">
            Files
          </p>
          <div className="px-2 pb-2">
            <button
              type="button"
              aria-current={home?.active === HOME_REPO ? "true" : undefined}
              disabled={busy || signedOut}
              className={cn(
                "flex min-h-11 w-full items-center gap-3 rounded-md px-2 py-2 text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                home?.active === HOME_REPO
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "hover:bg-sidebar-accent/70"
              )}
              onClick={() => selectRepo(HOME_REPO)}
            >
              <FileText
                className="size-3.5 shrink-0 text-kiln"
                aria-hidden
              />
              <span className="truncate text-sm font-medium">{README_PATH}</span>
            </button>
          </div>
          <p className="px-4 pt-2 pb-2 text-xs font-medium text-muted-foreground">
            Your repos
          </p>
          <ScrollArea className="min-h-0 flex-1 px-2 pb-3">
            {filtered.length === 0 ? (
              <p className="px-2 py-6 text-center text-sm text-muted-foreground">
                {signedOut
                  ? "Sign in to see your repos"
                  : userRepos.length
                    ? "No repos match that search"
                    : "No repos yet"}
              </p>
            ) : (
              <ul className="flex flex-col gap-0.5">
                {filtered.map((rel) => {
                  const selected = rel.name === home?.active;
                  return (
                    <li key={rel.oid}>
                      <button
                        type="button"
                        aria-current={selected ? "true" : undefined}
                        disabled={busy}
                        className={cn(
                          "flex min-h-11 w-full items-center gap-3 rounded-md px-2 py-2 text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                          selected
                            ? "bg-sidebar-accent text-sidebar-accent-foreground"
                            : "hover:bg-sidebar-accent/70"
                        )}
                        onClick={() => selectRepo(rel.name)}
                      >
                        <BookOpen
                          className="size-3.5 shrink-0 text-kiln"
                          aria-hidden
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">
                            {rel.name}
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {rel.nTuples} {rel.nTuples === 1 ? "file" : "files"}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </ScrollArea>
        </aside>

        <main className="flex min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto">
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
            <div>
              <h1 className="text-2xl font-medium tracking-tight">Home</h1>
              {subtitle ? (
                <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
              ) : null}
            </div>

            {!signedOut && userRepos.length > 0 ? (
              <div className="lg:hidden">
                <label className="sr-only" htmlFor="home-repo-select">
                  Repo
                </label>
                <select
                  id="home-repo-select"
                  className="h-11 w-full rounded-lg border border-border bg-card px-3 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  disabled={!home || busy}
                  value={home?.active ?? HOME_REPO}
                  onChange={(e) => selectRepo(e.target.value)}
                >
                  <option value={HOME_REPO}>{README_PATH}</option>
                  {userRepos.map((rel) => (
                    <option key={rel.oid} value={rel.name}>
                      {rel.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            <div className="relative">
              <label className="sr-only" htmlFor="home-search">
                Search repos
              </label>
              <Search
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                id="home-search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search your repos"
                className="h-12 pl-10"
                autoComplete="off"
              />
            </div>

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
              <div className="flex gap-2 lg:hidden">
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 min-w-0 flex-1"
                  disabled={!canRun}
                  onClick={() => setNewOpen(true)}
                >
                  <Plus />
                  New repo
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 min-w-0 flex-1"
                  onClick={() => router.push("/console")}
                >
                  SQL console
                </Button>
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
                  <EmptyTitle>Your README.md lives here</EmptyTitle>
                  <EmptyDescription>
                    Sign in with Privy. Slab creates a home repo and writes
                    README.md for this wallet.
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
                <Skeleton className="h-4 w-2/3 motion-reduce:animate-none" />
              </div>
            ) : null}

            {!error && !signedOut && home && !home.readme ? (
              <Empty className="border border-dashed border-border py-10">
                <EmptyHeader>
                  <EmptyTitle>No README.md</EmptyTitle>
                  <EmptyDescription>
                    This repo has no README.md yet.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : null}

            {!error && !signedOut && home?.readme ? (
              <section className="overflow-hidden rounded-lg border border-border bg-card">
                <div className="border-b border-border px-4 py-2.5">
                  <p className="truncate font-mono text-sm">{README_PATH}</p>
                </div>
                <div className="px-4 py-6 sm:px-6">
                  <DocsProse source={home.readme} variant="readme" />
                </div>
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

      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New repo</DialogTitle>
            <DialogDescription>
              Creates a table in your home catalog and writes README.md.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="new-repo-name">Name</Label>
            <Input
              id="new-repo-name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="notes"
              autoComplete="off"
              className="h-11 font-mono"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (canRun && newName.trim()) {
                    onCreate();
                  }
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="h-11 sm:h-8"
              onClick={() => setNewOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="h-11 sm:h-8"
              disabled={!canRun || !newName.trim()}
              onClick={onCreate}
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
