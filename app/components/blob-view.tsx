"use client";

import { useRouter } from "next/navigation";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { CommitBar } from "@/components/commit-bar";
import { FileSidebar } from "@/components/file-sidebar";
import { GoToFile } from "@/components/go-to-file";
import { RepoCrumb } from "@/components/repo-crumb";
import { RepoFile } from "@/components/repo-file";
import { RepoHeader } from "@/components/repo-header";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { useRepo } from "@/hooks/use-repo";
import { findFile, repoHref } from "@/lib/files";
import { latestCommitForPath } from "@/lib/history";

export function BlobView({
  uid,
  repo,
  path,
}: {
  uid: string;
  repo: string;
  path: string;
}) {
  const router = useRouter();
  const access = useRepo(uid, repo);
  const file = findFile(access.files, path);
  const commit =
    latestCommitForPath(access.commits, path) ?? access.commits[0] ?? null;

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <SiteHeader />
      {!access.loading && access.found && file ? (
        <RepoHeader
          uid={uid}
          repo={repo}
          pfp={access.profile?.pfp}
          own={access.own}
        />
      ) : null}
      <main id="main-content" tabIndex={-1} className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-4 px-4 py-4 sm:px-6">
        {access.error ? (
          <Alert variant="destructive">
            <AlertTitle>Could not load file</AlertTitle>
            <AlertDescription>{access.error}</AlertDescription>
          </Alert>
        ) : null}

        {access.loading ? (
          <div className="flex flex-col gap-3" aria-busy="true">
            <Skeleton className="h-6 w-64 motion-reduce:animate-none" />
            <Skeleton className="h-64 w-full motion-reduce:animate-none" />
          </div>
        ) : null}

        {!access.loading && (!access.found || !file) ? (
          <Empty className="border border-dashed border-border py-12">
            <EmptyHeader>
              <EmptyTitle>File not found</EmptyTitle>
              <EmptyDescription>
                {path} is not in {uid}/{repo}.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : null}

        {!access.loading && access.found && file ? (
          <div className="flex items-start gap-4">
            <FileSidebar
              uid={uid}
              repo={repo}
              files={access.files}
              current={path}
            />
            <div className="flex min-w-0 flex-1 flex-col gap-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <RepoCrumb uid={uid} repo={repo} path={path} skipOwner />
                <div className="lg:hidden">
                  <GoToFile uid={uid} repo={repo} files={access.files} />
                </div>
              </div>
              <div className="overflow-hidden rounded-md border border-border bg-card">
                <CommitBar
                  uid={uid}
                  repo={repo}
                  pfp={access.profile?.pfp}
                  commit={commit}
                />
              </div>
              <RepoFile
                key={path}
                label={path}
                path={path}
                source={file.body}
                chrome="page"
                canEdit={access.own}
                canDelete={access.own}
                status={access.status}
                onCommit={(body, message) => access.writeFile(path, body, message)}
                onDelete={async (message) => {
                  await access.removeFile(path, message);
                  router.push(repoHref(uid, repo));
                }}
              />
            </div>
          </div>
        ) : null}
      </main>
      <SiteFooter />
    </div>
  );
}
