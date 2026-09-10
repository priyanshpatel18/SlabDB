"use client";

import Link from "next/link";
import { CommitBar } from "@/components/commit-bar";
import { IconDirectory, IconFile } from "@/components/repo-icons";
import {
  blobHref,
  treeHref,
  type TreeEntry,
} from "@/lib/files";
import {
  formatAgo,
  latestCommitForPath,
  type CommitRecord,
} from "@/lib/history";

export function FileTree({
  uid,
  repo,
  dir,
  dirs,
  files,
  pfp,
  commits,
  showUp = false,
}: {
  uid: string;
  repo: string;
  dir: string;
  dirs: TreeEntry[];
  files: TreeEntry[];
  pfp?: string;
  commits: CommitRecord[];
  showUp?: boolean;
}) {
  const empty = dirs.length === 0 && files.length === 0 && !showUp;
  const latest =
    (dir ? latestCommitForPath(commits, dir) : commits[0]) ??
    commits[0] ??
    null;
  const up = dir.includes("/") ? dir.slice(0, dir.lastIndexOf("/")) : "";

  return (
    <div className="overflow-hidden rounded-md border border-border bg-card">
      <CommitBar uid={uid} repo={repo} pfp={pfp} commit={latest} />
      <div className="hidden grid-cols-[minmax(0,1fr)_minmax(0,1fr)_9rem] border-b border-border px-3 py-2 text-xs text-muted-foreground md:grid">
        <span>Name</span>
        <span>Last commit message</span>
        <span className="text-right">Last commit date</span>
      </div>
      {empty ? (
        <p className="px-3 py-8 text-center text-sm text-muted-foreground">
          {dir ? "This folder has no files." : "This repository is empty."}
        </p>
      ) : (
        <ul>
          {showUp ? (
            <li className="grid grid-cols-1 border-t border-border hover:bg-muted/40 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_9rem]">
              <Link
                href={treeHref(uid, repo, up)}
                className="flex min-h-10 items-center gap-2 px-3 text-sm text-muted-foreground hover:text-foreground"
              >
                <IconDirectory className="text-muted-foreground" />
                ..
              </Link>
              <span className="hidden md:block" />
              <span className="hidden md:block" />
            </li>
          ) : null}
          {dirs.map((entry) => {
            const commit = latestCommitForPath(commits, entry.path) ?? latest;
            return (
              <TreeRow
                key={`d:${entry.path}`}
                href={treeHref(uid, repo, entry.path)}
                name={entry.name}
                kind="dir"
                summary={commit?.message ?? ""}
                when={commit?.created_at ? formatAgo(commit.created_at) : ""}
              />
            );
          })}
          {files.map((entry) => {
            const commit = latestCommitForPath(commits, entry.path) ?? latest;
            return (
              <TreeRow
                key={`f:${entry.path}`}
                href={blobHref(uid, repo, entry.path)}
                name={entry.name}
                kind="file"
                summary={commit?.message ?? ""}
                when={commit?.created_at ? formatAgo(commit.created_at) : ""}
              />
            );
          })}
        </ul>
      )}
    </div>
  );
}

function TreeRow({
  href,
  name,
  kind,
  summary,
  when,
}: {
  href: string;
  name: string;
  kind: "dir" | "file";
  summary: string;
  when: string;
}) {
  return (
    <li className="grid grid-cols-1 border-t border-border hover:bg-muted/40 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_9rem]">
      <Link
        href={href}
        className="flex min-h-10 items-center gap-2 px-3 text-sm text-foreground hover:underline focus-visible:underline"
      >
        {kind === "dir" ? (
          <IconDirectory className="text-muted-foreground" />
        ) : (
          <IconFile className="text-muted-foreground" />
        )}
        <span className="truncate">{name}</span>
      </Link>
      <Link
        href={href}
        tabIndex={-1}
        className="hidden min-h-10 items-center truncate px-3 text-sm text-muted-foreground hover:text-kiln hover:underline md:flex"
      >
        {summary}
      </Link>
      <span className="hidden min-h-10 items-center justify-end px-3 text-xs text-muted-foreground md:flex">
        {when}
      </span>
    </li>
  );
}
