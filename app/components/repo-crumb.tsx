"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { profilePath } from "@/lib/cluster";
import { repoHref, treeHref } from "@/lib/files";

export function RepoCrumb({
  uid,
  repo,
  path = "",
  skipOwner = false,
}: {
  uid: string;
  repo: string;
  path?: string;
  skipOwner?: boolean;
}) {
  const parts = path ? path.split("/").filter(Boolean) : [];
  return (
    <nav aria-label="Repository path" className="flex min-w-0 flex-wrap items-center gap-1 text-sm">
      {skipOwner ? null : (
        <>
          <Link
            href={profilePath(uid)}
            className="text-kiln hover:underline focus-visible:underline"
          >
            {uid}
          </Link>
          <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
        </>
      )}
      <Link
        href={repoHref(uid, repo)}
        className="font-medium text-kiln hover:underline focus-visible:underline"
      >
        {repo}
      </Link>
      {parts.map((part, i) => {
        const dir = parts.slice(0, i + 1).join("/");
        const last = i === parts.length - 1;
        return (
          <span key={dir} className="flex min-w-0 items-center gap-1">
            <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
            {last ? (
              <span className="truncate font-medium text-foreground">{part}</span>
            ) : (
              <Link
                href={treeHref(uid, repo, dir)}
                className="truncate text-kiln hover:underline focus-visible:underline"
              >
                {part}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
