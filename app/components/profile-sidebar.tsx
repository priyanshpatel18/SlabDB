"use client";

import Link from "next/link";
import { Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Pfp } from "@/components/pfp";
import type { Profile } from "@/lib/profile";

function hrefLabel(href: string): string {
  return href.replace(/^https?:\/\//i, "").replace(/\/$/, "");
}

function ProfileLink({ href }: { href: string }) {
  return (
    <li>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="flex min-h-10 items-center gap-2 text-sm text-muted-foreground hover:text-kiln hover:underline focus-visible:text-kiln sm:min-h-7"
      >
        <Link2 className="size-4 shrink-0" aria-hidden />
        <span className="truncate">{hrefLabel(href)}</span>
        <span className="sr-only"> (opens in a new tab)</span>
      </a>
    </li>
  );
}

export function ProfileSidebar({
  profile,
  canEdit,
}: {
  profile: Profile | null;
  canEdit: boolean;
}) {
  const links = [
    profile?.website?.trim() ?? "",
    ...(profile?.links ?? []),
  ].filter(Boolean);

  return (
    <div className="px-4 py-5 lg:py-6 lg:pr-8">
      <div className="flex items-center gap-4 lg:flex-col lg:items-stretch lg:gap-0">
        <Pfp
          id={profile?.pfp}
          alt={profile?.name || profile?.uid || ""}
          className="h-[72px] w-[72px] border border-border shadow-[0_0_0_1px_oklch(0_0_0/0.04)] sm:h-20 sm:w-20 lg:aspect-square lg:h-auto lg:w-full"
        />
        <div className="min-w-0 flex-1 lg:mt-4">
          {profile?.name ? (
            <h1 className="truncate text-xl leading-tight font-semibold lg:text-2xl">
              {profile.name}
            </h1>
          ) : null}
          {profile?.uid ? (
            <p className="truncate text-base leading-tight font-light text-muted-foreground lg:text-xl">
              {profile.uid}
            </p>
          ) : null}
        </div>
      </div>
      {profile?.bio ? (
        <p className="mt-3 text-sm leading-snug text-foreground">
          {profile.bio}
        </p>
      ) : null}
      {canEdit ? (
        <Button
          type="button"
          variant="outline"
          className="mt-4 h-10 w-full text-sm font-medium"
          nativeButton={false}
          render={<Link href="/settings" />}
        >
          Edit profile
        </Button>
      ) : null}
      {links.length > 0 ? (
        <ul className="mt-4 flex flex-col">
          {links.map((href) => (
            <ProfileLink key={href} href={href} />
          ))}
        </ul>
      ) : null}
    </div>
  );
}
