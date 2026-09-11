"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { FileSidebar } from "@/components/file-sidebar";
import { FileTree } from "@/components/file-tree";
import { GoToFile } from "@/components/go-to-file";
import { RepoAbout } from "@/components/repo-about";
import { RepoCliSetup } from "@/components/repo-cli-setup";
import { RepoCrumb } from "@/components/repo-crumb";
import { RepoFile } from "@/components/repo-file";
import { RepoHeader } from "@/components/repo-header";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { useRepo } from "@/hooks/use-repo";
import {
  dirExists,
  dirReadmePath,
  findFile,
  listDir,
} from "@/lib/files";

export function RepoView({
  uid,
  repo,
  dir = "",
}: {
  uid: string;
  repo: string;
  dir?: string;
}) {
  const access = useRepo(uid, repo);
  const atRoot = !dir;
  const listing = listDir(access.files, dir);
  const readme = findFile(access.files, dirReadmePath(dir));
  const missingDir = Boolean(
    dir && !access.loading && access.found && !dirExists(access.files, dir)
  );

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
      <main id="main-content" tabIndex={-1} className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 py-4 sm:px-6">
        {access.error ? (
          <Alert variant="destructive" className="mb-6">
            <AlertTitle>Could not load repository</AlertTitle>
            <AlertDescription>{access.error}</AlertDescription>
          </Alert>
        ) : null}

        {access.loading ? (
          <div className="flex flex-col gap-3" aria-busy="true">
            <Skeleton className="h-6 w-48 motion-reduce:animate-none" />
            <Skeleton className="h-48 w-full motion-reduce:animate-none" />
          </div>
        ) : null}

        {!access.loading && !access.profile ? (
          <Empty className="border border-dashed border-border py-12">
            <EmptyHeader>
              <EmptyTitle>Profile not found</EmptyTitle>
              <EmptyDescription>No user has this username.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : null}

        {!access.loading && access.profile && !access.found ? (
          <Empty className="border border-dashed border-border py-12">
            <EmptyHeader>
              <EmptyTitle>Repository not found</EmptyTitle>
              <EmptyDescription>
                {uid} has no repository named {repo}.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : null}

        {!access.loading && access.profile && access.found && missingDir ? (
          <Empty className="border border-dashed border-border py-12">
            <EmptyHeader>
              <EmptyTitle>Folder not found</EmptyTitle>
              <EmptyDescription>
                This path is not in the repository.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : null}

        {!access.loading && access.profile && access.found && !missingDir ? (
          atRoot ? (
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-6">
              <div className="flex min-w-0 flex-1 flex-col gap-4">
                {listing.dirs.length === 0 && listing.files.length === 0 ? (
                  <RepoCliSetup
                    uid={uid}
                    repo={repo}
                    canAddFile={access.own}
                  />
                ) : (
                  <>
                    <div className="flex justify-end">
                      <GoToFile uid={uid} repo={repo} files={access.files} />
                    </div>
                    <FileTree
                      uid={uid}
                      repo={repo}
                      dir={dir}
                      dirs={listing.dirs}
                      files={listing.files}
                      pfp={access.profile.pfp}
                      commits={access.commits}
                    />
                  </>
                )}
                {readme ? (
                  <div id="readme">
                    <RepoFile
                      label="README.md"
                      path={dirReadmePath(dir)}
                      source={readme.body}
                      canEdit={access.own}
                      canDelete={false}
                      status={access.status}
                      onCommit={(body, message) =>
                        access.writeFile(dirReadmePath(dir), body, message)
                      }
                    />
                  </div>
                ) : null}
              </div>
              <RepoAbout
                description={access.description}
                website={access.website}
                readmeHref={readme ? "#readme" : undefined}
                canEdit={access.own}
                onSave={access.writeAbout}
              />
            </div>
          ) : (
            <div className="flex items-start gap-4">
              <FileSidebar
                uid={uid}
                repo={repo}
                files={access.files}
                current={dir}
              />
              <div className="flex min-w-0 flex-1 flex-col gap-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <RepoCrumb uid={uid} repo={repo} path={dir} skipOwner />
                  <div className="lg:hidden">
                    <GoToFile uid={uid} repo={repo} files={access.files} />
                  </div>
                </div>
                <FileTree
                  uid={uid}
                  repo={repo}
                  dir={dir}
                  dirs={listing.dirs}
                  files={listing.files}
                  pfp={access.profile.pfp}
                  commits={access.commits}
                  showUp
                />
                {readme ? (
                  <div id="readme">
                    <RepoFile
                      label="README.md"
                      path={dirReadmePath(dir)}
                      source={readme.body}
                      canEdit={access.own}
                      canDelete={access.own}
                      status={access.status}
                      onCommit={(body, message) =>
                        access.writeFile(dirReadmePath(dir), body, message)
                      }
                      onDelete={(message) =>
                        access.removeFile(dirReadmePath(dir), message)
                      }
                    />
                  </div>
                ) : null}
              </div>
            </div>
          )
        ) : null}
      </main>
      <SiteFooter />
    </div>
  );
}
