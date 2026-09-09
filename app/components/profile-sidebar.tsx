"use client";

import Link from "next/link";
import { Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Pfp } from "@/components/pfp";
import type { Profile } from "@/lib/profile";

export function ProfileSidebar({
  profile,
  canEdit,
}: {
  profile: Profile | null;
  canEdit: boolean;
}) {
  return (
    <div className="px-4 py-6">
      <Pfp id={profile?.pfp} size={260} className="w-full max-w-[260px]" />
      {profile?.name ? (
        <h1 className="mt-4 truncate text-2xl font-semibold tracking-tight">
          {profile.name}
        </h1>
      ) : null}
      {profile?.uid ? (
        <p className="truncate text-lg text-muted-foreground">{profile.uid}</p>
      ) : null}
      {profile?.bio ? (
        <p className="mt-4 text-sm text-muted-foreground">{profile.bio}</p>
      ) : null}
      {canEdit ? (
        <Button
          type="button"
          variant="outline"
          className="mt-4 h-10 w-full"
          nativeButton={false}
          render={<Link href="/settings" />}
        >
          Edit profile
        </Button>
      ) : null}
      {profile?.website ? (
        <a
          href={profile.website}
          target="_blank"
          rel="noreferrer"
          className="mt-4 flex min-h-10 items-center gap-2 truncate text-sm text-kiln hover:underline"
        >
          <Link2 className="size-3.5 shrink-0" aria-hidden />
          <span className="truncate">
            {profile.website.replace(/^https?:\/\//, "")}
          </span>
        </a>
      ) : null}
      {(profile?.links ?? [])
        .filter((link) => link.trim())
        .map((link) => (
          <a
            key={link}
            href={link}
            target="_blank"
            rel="noreferrer"
            className="mt-1 flex min-h-10 items-center gap-2 truncate text-sm text-muted-foreground hover:text-foreground"
          >
            <Link2 className="size-3.5 shrink-0" aria-hidden />
            <span className="truncate">{link.replace(/^https?:\/\//, "")}</span>
          </a>
        ))}
    </div>
  );
}
