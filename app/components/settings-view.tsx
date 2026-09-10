"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { RepoHeader } from "@/components/repo-header";
import { SiteHeader } from "@/components/site-header";
import { useRepo } from "@/hooks/use-repo";
import { profilePath } from "@/lib/cluster";
import { isRepoName, settingsHref } from "@/lib/files";
import { assertRepoName } from "@/lib/home";

export function SettingsView({ uid, repo }: { uid: string; repo: string }) {
  const router = useRouter();
  const access = useRepo(uid, repo);
  const [name, setName] = useState(repo);
  const [bound, setBound] = useState(repo);
  const [confirm, setConfirm] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (repo !== bound) {
    setBound(repo);
    setName(repo);
    setConfirm("");
  }

  const taken = useMemo(() => {
    const key = name.trim().toLowerCase();
    if (!key || key === repo) {
      return false;
    }
    return access.repos.some((rel) => rel.name === key);
  }, [access.repos, name, repo]);

  const nameError = useMemo(() => {
    const raw = name.trim();
    if (!raw || raw.toLowerCase() === repo) {
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
  }, [name, repo, taken]);

  const canRename =
    access.own &&
    !renaming &&
    !deleting &&
    !nameError &&
    isRepoName(name.trim().toLowerCase()) &&
    name.trim().toLowerCase() !== repo;

  const canDelete =
    access.own && !renaming && !deleting && confirm.trim() === repo;

  function onRename() {
    if (!canRename) {
      return;
    }
    setRenaming(true);
    void access
      .rename(name)
      .then((next) => {
        toast.success(`Renamed to ${next}`);
        router.push(settingsHref(uid, next));
      })
      .catch((err) => {
        toast.error(err instanceof Error ? err.message : "Could not rename");
      })
      .finally(() => {
        setRenaming(false);
      });
  }

  function onDelete() {
    if (!canDelete) {
      return;
    }
    setDeleting(true);
    void access
      .destroy()
      .then(() => {
        toast.success(`Deleted ${repo}`);
        router.push(profilePath(uid));
      })
      .catch((err) => {
        toast.error(err instanceof Error ? err.message : "Could not delete");
        setDeleting(false);
      });
  }

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <SiteHeader />
      {!access.loading && access.profile && access.found ? (
        <RepoHeader
          uid={uid}
          repo={repo}
          pfp={access.profile.pfp}
          own={access.own}
          active="settings"
        />
      ) : null}
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-6 sm:px-6">
        {access.error ? (
          <Alert variant="destructive" className="mb-6">
            <AlertTitle>Could not load repository</AlertTitle>
            <AlertDescription>{access.error}</AlertDescription>
          </Alert>
        ) : null}

        {access.loading ? (
          <div className="flex flex-col gap-3" aria-busy="true">
            <Skeleton className="h-10 w-full motion-reduce:animate-none" />
            <Skeleton className="h-24 w-full motion-reduce:animate-none" />
          </div>
        ) : null}

        {!access.loading && !access.found ? (
          <Empty className="border border-dashed border-border py-12">
            <EmptyHeader>
              <EmptyTitle>Repository not found</EmptyTitle>
              <EmptyDescription>
                {uid} has no repository named {repo}.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : null}

        {!access.loading && access.found && !access.own ? (
          <Empty className="border border-dashed border-border py-12">
            <EmptyHeader>
              <EmptyTitle>Owner only</EmptyTitle>
              <EmptyDescription>
                Sign in as {uid} to change this repository.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : null}

        {!access.loading && access.found && access.own ? (
          <div className="flex flex-col gap-10">
            <section className="flex flex-col gap-4">
              <div>
                <h2 className="text-lg font-semibold">Repository name</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Unique on this profile. Use a-z, 0-9, -, and _.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <Label htmlFor="repo-rename">Name</Label>
                  <Input
                    id="repo-rename"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    autoComplete="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    aria-invalid={Boolean(nameError)}
                    className="h-11 font-mono"
                    disabled={renaming || deleting}
                  />
                </div>
                <Button
                  type="button"
                  className="h-11 sm:min-w-32"
                  disabled={!canRename}
                  onClick={onRename}
                >
                  {renaming ? "Renaming" : "Rename"}
                </Button>
              </div>
              {nameError ? (
                <p className="text-sm text-destructive">{nameError}</p>
              ) : name.trim() && name.trim().toLowerCase() !== repo ? (
                <p className="text-sm text-muted-foreground">
                  {uid}/{name.trim().toLowerCase()}
                </p>
              ) : null}
            </section>

            <section className="flex flex-col gap-4 border-t border-border pt-8">
              <h2 className="text-lg font-semibold">Visibility</h2>
              <fieldset className="flex flex-col gap-3 rounded-lg border border-border px-4 py-4">
                <legend className="sr-only">Visibility</legend>
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
            </section>

            <section className="flex flex-col gap-4 border-t border-border pt-8">
              <div>
                <h2 className="text-lg font-semibold text-destructive">
                  Delete repository
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  This drops the table and all files. Type{" "}
                  <span className="font-mono text-foreground">{repo}</span> to
                  confirm.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <Label htmlFor="repo-delete">Confirm name</Label>
                  <Input
                    id="repo-delete"
                    value={confirm}
                    onChange={(event) => setConfirm(event.target.value)}
                    autoComplete="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    className="h-11 font-mono"
                    disabled={renaming || deleting}
                  />
                </div>
                <Button
                  type="button"
                  variant="destructive"
                  className="h-11 sm:min-w-40"
                  disabled={!canDelete}
                  onClick={onDelete}
                >
                  {deleting ? "Deleting" : "Delete repository"}
                </Button>
              </div>
            </section>
          </div>
        ) : null}
      </main>
    </div>
  );
}
