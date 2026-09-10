"use client";

import Link from "next/link";
import { Pfp } from "@/components/pfp";
import { IconHistory } from "@/components/repo-icons";
import { profilePath } from "@/lib/cluster";
import { commitHref, commitsHref } from "@/lib/files";
import { formatAgo, type CommitRecord } from "@/lib/history";

export function CommitBar({
  uid,
  repo,
  pfp,
  commit,
}: {
  uid: string;
  repo: string;
  pfp?: string;
  commit: CommitRecord | null;
}) {
  return (
    <div className="flex min-h-12 items-center gap-3 border-b border-border bg-muted/30 px-3 py-2">
      <Link
        href={profilePath(uid)}
        className="shrink-0 rounded-full focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Pfp id={pfp} alt="" size={20} className="size-5" />
      </Link>
      <p className="min-w-0 flex-1 truncate text-sm">
        {commit ? (
          <>
            <Link
              href={profilePath(uid)}
              className="font-semibold text-foreground hover:text-kiln hover:underline focus-visible:underline"
            >
              {commit.author || uid}
            </Link>{" "}
            <Link
              href={commitHref(uid, repo, commit.id)}
              className="text-foreground hover:text-kiln hover:underline focus-visible:underline"
            >
              {commit.message}
            </Link>
          </>
        ) : (
          <span className="text-muted-foreground">No commits yet</span>
        )}
      </p>
      {commit ? (
        <span className="hidden shrink-0 font-mono text-xs text-muted-foreground sm:inline">
          {commit.id}
        </span>
      ) : null}
      {commit ? (
        <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
          {formatAgo(commit.created_at)}
        </span>
      ) : null}
      <Link
        href={commitsHref(uid, repo)}
        className="hidden shrink-0 items-center gap-1 text-xs text-muted-foreground hover:text-kiln sm:flex"
      >
        <IconHistory className="size-3.5" />
        History
      </Link>
    </div>
  );
}
