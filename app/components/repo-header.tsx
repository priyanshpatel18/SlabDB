"use client";

import Link from "next/link";
import { cn } from "cn";
import { Badge } from "@/components/ui/badge";
import { Pfp } from "@/components/pfp";
import { IconCode, IconGear } from "@/components/repo-icons";
import { profilePath } from "@/lib/cluster";
import { repoHref, settingsHref } from "@/lib/files";

export function RepoHeader({
  uid,
  repo,
  pfp,
  own = false,
  active = "code",
}: {
  uid: string;
  repo: string;
  pfp?: string;
  own?: boolean;
  active?: "code" | "settings";
}) {
  return (
    <div className="border-b border-border">
      <div className="mx-auto w-full max-w-7xl px-4 pt-6 sm:px-6 sm:pt-8">
        <div className="flex min-h-12 flex-wrap items-center gap-2 pb-4">
          <Pfp id={pfp} alt={uid} size={24} className="size-6 rounded-full" />
          <h1 className="flex min-w-0 flex-wrap items-center gap-1 text-xl font-normal leading-tight">
            <Link
              href={profilePath(uid)}
              className="truncate text-kiln hover:underline focus-visible:underline"
            >
              {uid}
            </Link>
            <span className="text-muted-foreground" aria-hidden>
              /
            </span>
            <Link
              href={repoHref(uid, repo)}
              className="truncate font-semibold text-kiln hover:underline focus-visible:underline"
            >
              {repo}
            </Link>
          </h1>
          <Badge
            variant="outline"
            className="h-5 rounded-full px-2 text-xs font-normal text-muted-foreground"
          >
            Public
          </Badge>
        </div>
        <nav aria-label="Repository" className="flex items-end gap-1">
          <Link
            href={repoHref(uid, repo)}
            className={cn(
              "relative inline-flex min-h-10 items-center gap-2 px-3 pb-2 text-sm font-medium",
              active === "code"
                ? "text-foreground after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:bg-kiln"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <IconCode className="text-muted-foreground" />
            Code
          </Link>
          {own ? (
            <Link
              href={settingsHref(uid, repo)}
              className={cn(
                "relative inline-flex min-h-10 items-center gap-2 px-3 pb-2 text-sm font-medium",
                active === "settings"
                  ? "text-foreground after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:bg-kiln"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <IconGear className="text-muted-foreground" />
              Settings
            </Link>
          ) : null}
        </nav>
      </div>
    </div>
  );
}
