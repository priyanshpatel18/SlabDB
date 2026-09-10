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
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { useRepo } from "@/hooks/use-repo";
import { commitHref } from "@/lib/files";
import { formatAgo, formatCommitStamp, groupCommitsByDay } from "@/lib/history";

export function CommitsView({ uid, repo }: { uid: string; repo: string }) {
  const access = useRepo(uid, repo);
  const groups = groupCommitsByDay(access.commits);

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <SiteHeader />
      {!access.loading && access.profile && access.found ? (
        <RepoHeader
          uid={uid}
          repo={repo}
          pfp={access.profile.pfp}
          own={access.own}
        />
      ) : null}
      <main id="main-content" tabIndex={-1} className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 py-6 sm:px-6">
        {access.error ? (
          <Alert variant="destructive" className="mb-6">
            <AlertTitle>Could not load commits</AlertTitle>
            <AlertDescription>{access.error}</AlertDescription>
          </Alert>
        ) : null}

        {access.loading ? (
          <div className="flex flex-col gap-3" aria-busy="true">
            <Skeleton className="h-10 w-full motion-reduce:animate-none" />
            <Skeleton className="h-10 w-full motion-reduce:animate-none" />
          </div>
        ) : null}

        {!access.loading && access.found ? (
          <>
            <h1 className="mb-6 text-xl font-semibold">Commits</h1>
            {access.commits.length === 0 ? (
              <Empty className="border border-dashed border-border py-12">
                <EmptyHeader>
                  <EmptyTitle>No commits yet</EmptyTitle>
                  <EmptyDescription>
                    File writes that change content create a commit.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <div className="flex flex-col gap-8">
                {groups.map((group) => (
                  <section key={group.day}>
                    <h2 className="mb-3 text-sm font-semibold text-foreground">
                      {group.day}
                    </h2>
                    <ol className="overflow-hidden rounded-md border border-border bg-card">
                      {group.commits.map((commit, i) => (
                        <li
                          key={commit.id}
                          className={i === 0 ? "" : "border-t border-border"}
                        >
                          <div className="flex min-h-14 items-start gap-3 px-4 py-3">
                            <div className="min-w-0 flex-1">
                              <Link
                                href={commitHref(uid, repo, commit.id)}
                                className="block truncate text-sm font-semibold text-foreground hover:text-kiln hover:underline focus-visible:underline"
                              >
                                {commit.message}
                              </Link>
                              <p className="mt-1 flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
                                <Pfp
                                  id={access.profile?.pfp}
                                  alt={commit.author || uid}
                                  size={20}
                                  className="size-5"
                                />
                                <span className="truncate">
                                  {commit.author || uid} committed{" "}
                                  {formatAgo(commit.created_at)}
                                  {formatCommitStamp(commit.created_at)
                                    ? ` · ${formatCommitStamp(commit.created_at)}`
                                    : ""}
                                </span>
                              </p>
                            </div>
                            <Link
                              href={commitHref(uid, repo, commit.id)}
                              className="shrink-0 rounded-md border border-border px-2 py-1 font-mono text-xs text-muted-foreground hover:text-kiln"
                            >
                              {commit.id}
                            </Link>
                          </div>
                        </li>
                      ))}
                    </ol>
                  </section>
                ))}
              </div>
            )}
          </>
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
      </main>
      <SiteFooter />
    </div>
  );
}
