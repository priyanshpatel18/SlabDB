"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SiteHeader } from "@/components/site-header";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useAccount } from "@/hooks/use-account";
import { useSlabWallet } from "@/hooks/use-slab-wallet";
import { shortAddr } from "@/lib/cluster";
import { assertRepoName, createRepo } from "@/lib/home";
import { DESC_MAX, repoHref } from "@/lib/files";
import { privyConfigured } from "@/lib/privy-config";

export function NewRepo() {
  const router = useRouter();
  const wallet = useSlabWallet();
  const account = useAccount();
  const home = account.home;
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [addReadme, setAddReadme] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");

  const taken = useMemo(() => {
    const key = name.trim().toLowerCase();
    if (!key) {
      return false;
    }
    return (home?.repos ?? []).some((rel) => rel.name === key);
  }, [home?.repos, name]);

  const nameError = useMemo(() => {
    const raw = name.trim();
    if (!raw) {
      return "";
    }
    try {
      assertRepoName(raw);
    } catch (err) {
      return err instanceof Error ? err.message : "Invalid name";
    }
    if (taken) {
      return "You already have this repo";
    }
    return "";
  }, [name, taken]);

  const owner = account.profile?.uid || (wallet.address ? shortAddr(wallet.address) : "");
  const signedOut = !wallet.connected;
  const canCreate =
    Boolean(home && wallet.address) &&
    !account.busy &&
    !saving &&
    !nameError &&
    Boolean(name.trim());

  function onCreate() {
    if (!home || !wallet.address || !canCreate) {
      return;
    }
    setSaving(true);
    setStatus("");
    void createRepo(home.session, name, wallet.address, setStatus, {
      description,
      addReadme,
      author: account.profile?.uid,
    })
      .then((next) => {
        account.setHome(next);
        toast.success(`Created ${next.active}`);
        const uid = account.profile?.uid;
        router.push(uid ? repoHref(uid, next.active) : "/");
      })
      .catch((err) => {
        toast.error(err instanceof Error ? err.message : "Could not create repo");
      })
      .finally(() => {
        setSaving(false);
      });
  }

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-medium tracking-tight">
          Create a new repository
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          A repository holds files in folders, like GitHub.
        </p>

        {account.error ? (
          <Alert variant="destructive" className="mt-6">
            <AlertTitle>Could not load home</AlertTitle>
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
        ) : null}

        {signedOut ? (
          <Empty className="mt-8 border border-dashed border-border py-12">
            <EmptyHeader>
              <EmptyTitle>Sign in to create a repository</EmptyTitle>
              <EmptyDescription>
                Sign in with Privy. The repo is stored in your home catalog.
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

        {!signedOut && !home && account.busy ? (
          <div className="mt-8 flex flex-col gap-3" aria-busy="true">
            <Skeleton className="h-11 w-full motion-reduce:animate-none" />
            <Skeleton className="h-24 w-full motion-reduce:animate-none" />
            <Skeleton className="h-11 w-40 motion-reduce:animate-none" />
          </div>
        ) : null}

        {!signedOut && !home && !account.busy && !account.error ? (
          <p className="mt-8 text-sm text-muted-foreground">
            Fund this wallet with SOL to create a repository.
          </p>
        ) : null}

        {!signedOut && home ? (
          <form
            className="mt-8 flex flex-col gap-6"
            onSubmit={(event) => {
              event.preventDefault();
              onCreate();
            }}
          >
            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1.4fr)] sm:items-end">
              <div className="flex flex-col gap-2">
                <Label htmlFor="new-owner">Owner</Label>
                <Input
                  id="new-owner"
                  value={owner}
                  readOnly
                  className="h-11 font-mono"
                />
              </div>
              <p className="hidden pb-3 text-xl text-muted-foreground sm:block">
                /
              </p>
              <div className="flex flex-col gap-2">
                <Label htmlFor="new-repo-name">Repository name</Label>
                <Input
                  id="new-repo-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="solana-programs"
                  autoComplete="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  aria-invalid={Boolean(nameError)}
                  className="h-11 font-mono"
                />
              </div>
            </div>
            {nameError ? (
              <p className="text-sm text-destructive">{nameError}</p>
            ) : name.trim() ? (
              <p className="text-sm text-muted-foreground">
                {owner}/{name.trim().toLowerCase()}
              </p>
            ) : null}

            <div className="flex flex-col gap-2">
              <Label htmlFor="new-repo-desc">Description (optional)</Label>
              <Textarea
                id="new-repo-desc"
                value={description}
                onChange={(event) =>
                  setDescription(event.target.value.slice(0, DESC_MAX))
                }
                maxLength={DESC_MAX}
                rows={3}
                className="min-h-20"
              />
              <p className="text-xs text-muted-foreground">
                {DESC_MAX - description.length} left. Shown in About. Not part of
                the README.
              </p>
            </div>

            <fieldset className="flex flex-col gap-3 rounded-lg border border-border px-4 py-4">
              <legend className="px-1 text-sm font-medium">Visibility</legend>
              <label className="flex min-h-10 items-start gap-3">
                <input
                  type="radio"
                  name="visibility"
                  value="public"
                  defaultChecked
                  className="mt-1 size-4 accent-kiln"
                />
                <span>
                  <span className="block text-sm font-medium">Public</span>
                  <span className="block text-sm text-muted-foreground">
                    Anyone can read this repo. Pages on Irys are public.
                  </span>
                </span>
              </label>
              <label className="flex min-h-10 items-start gap-3 opacity-50">
                <input
                  type="radio"
                  name="visibility"
                  disabled
                  className="mt-1 size-4"
                />
                <span>
                  <span className="block text-sm font-medium">Private</span>
                  <span className="block text-sm text-muted-foreground">
                    Not available. Slab pages are public.
                  </span>
                </span>
              </label>
            </fieldset>

            <label className="flex min-h-10 items-start gap-3">
              <input
                type="checkbox"
                checked={addReadme}
                onChange={(event) => setAddReadme(event.target.checked)}
                className="mt-1 size-4 accent-kiln"
              />
              <span>
                <span className="block text-sm font-medium">
                Add a README.md
              </span>
              <span className="block text-sm text-muted-foreground">
                Writes README.md as the first file. You can add more files after create.
              </span>
              </span>
            </label>

            {status ? (
              <p className="text-sm text-muted-foreground">{status}</p>
            ) : null}

            <div className="flex flex-col gap-3 border-t border-border pt-6 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                className="h-11"
                nativeButton={false}
                render={<Link href="/" />}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="h-11 sm:min-w-40"
                disabled={!canCreate}
              >
                {saving ? "Creating" : "Create repository"}
              </Button>
            </div>
          </form>
        ) : null}
      </main>
    </div>
  );
}
