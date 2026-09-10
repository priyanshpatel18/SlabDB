"use client";

import Link from "next/link";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { Pfp } from "@/components/pfp";
import { RepoHeader } from "@/components/repo-header";
import { SiteHeader } from "@/components/site-header";
import { useRepo } from "@/hooks/use-repo";
import { blobHref, commitsHref, repoHref } from "@/lib/files";
import { fileAtCommit, formatAgo, formatCommitStamp } from "@/lib/history";

export function CommitView({
  uid,
  repo,
  id,
}: {
  uid: string;
  repo: string;
  id: string;
}) {
  const access = useRepo(uid, repo);
  const commit = access.commits.find((item) => item.id === id) ?? null;

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <SiteHeader />
      {!access.loading && access.profile && access.found ? (
        <RepoHeader uid={uid} repo={repo} pfp={access.profile.pfp} own={access.own} />
      ) : null}
      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-4 px-4 py-6 sm:px-6">
        {access.error ? (
          <Alert variant="destructive">
            <AlertTitle>Could not load commit</AlertTitle>
            <AlertDescription>{access.error}</AlertDescription>
          </Alert>
        ) : null}

        {access.loading ? (
          <div className="flex flex-col gap-3" aria-busy="true">
            <Skeleton className="h-10 w-64 motion-reduce:animate-none" />
            <Skeleton className="h-48 w-full motion-reduce:animate-none" />
          </div>
        ) : null}

        {!access.loading && access.found && !commit ? (
          <Empty className="border border-dashed border-border py-12">
            <EmptyHeader>
              <EmptyTitle>Commit not found</EmptyTitle>
              <EmptyDescription>
                {id} is not in this repository.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : null}

        {!access.loading && commit ? (
          <>
            <p className="text-sm text-muted-foreground">
              <Link href={repoHref(uid, repo)} className="hover:text-kiln hover:underline">
                {uid}/{repo}
              </Link>
              {" · "}
              <Link href={commitsHref(uid, repo)} className="hover:text-kiln hover:underline">
                Commits
              </Link>
            </p>
            <div className="rounded-md border border-border bg-card px-4 py-4">
              <h1 className="text-xl font-semibold">{commit.message}</h1>
              <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                <Pfp
                  id={access.profile?.pfp}
                  alt=""
                  size={20}
                  className="size-5"
                />
                <span className="font-medium text-foreground">
                  {commit.author || uid}
                </span>
                <span>committed {formatAgo(commit.created_at)}</span>
                {formatCommitStamp(commit.created_at) ? (
                  <time
                    dateTime={commit.created_at}
                    className="text-xs"
                  >
                    {formatCommitStamp(commit.created_at)}
                  </time>
                ) : null}
                <span className="font-mono text-xs">{commit.id}</span>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              {commit.files.length} {commit.files.length === 1 ? "file" : "files"} changed
            </p>
            <ul className="flex flex-col gap-3">
              {commit.files.map((file) => {
                const before =
                  commit.parent
                    ? fileAtCommit(access.commits, commit.parent, file.path)
                    : null;
                const after = file.action === "delete" ? null : (file.body ?? "");
                return (
                  <li
                    key={file.path}
                    className="overflow-hidden rounded-md border border-border bg-card"
                  >
                    <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
                      <Link
                        href={blobHref(uid, repo, file.path)}
                        className="truncate font-mono text-sm text-kiln hover:underline"
                      >
                        {file.path}
                      </Link>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {file.action}
                      </span>
                    </div>
                    <pre className="overflow-x-auto px-3 py-3 font-mono text-xs leading-5 text-muted-foreground">
                      {file.action === "delete"
                        ? before || "File deleted"
                        : after || "Empty file"}
                    </pre>
                  </li>
                );
              })}
            </ul>
          </>
        ) : null}
      </main>
    </div>
  );
}
