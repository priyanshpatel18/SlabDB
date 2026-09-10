import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { UserProfile } from "@/components/user-profile";
import { isReservedUsername } from "@/lib/cluster";
import { getSEOTags } from "@/lib/seo";
import { site } from "@/lib/site";
import {
  isUsernameFormat,
  lookupUsernameRemote,
  normalizeUsername,
} from "@/lib/username-lookup";

type UserParams = { username: string };

async function resolveUid(raw: string): Promise<string | null> {
  const uid = normalizeUsername(raw);
  if (!isUsernameFormat(uid) || isReservedUsername(uid)) {
    return null;
  }
  return uid;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<UserParams>;
}): Promise<Metadata> {
  const { username } = await params;
  const uid = await resolveUid(username);
  if (!uid) {
    return getSEOTags({ title: "Not found", canonicalUrlRelative: "/" });
  }
  let profile = null;
  try {
    profile = await lookupUsernameRemote(uid);
  } catch {
    profile = null;
  }
  const title = profile?.name ? `${profile.name} (@${uid})` : uid;
  return getSEOTags({
    title,
    description: site.appDescription,
    canonicalUrlRelative: `/${uid}`,
    openGraph: {
      title: site.appName,
      description: site.appDescription,
    },
  });
}

export default async function UsernamePage({
  params,
}: {
  params: Promise<UserParams>;
}) {
  const { username } = await params;
  const uid = await resolveUid(username);
  if (!uid) {
    notFound();
  }
  let initial = null;
  try {
    initial = await lookupUsernameRemote(uid);
  } catch {
    initial = null;
  }
  return <UserProfile uid={uid} initial={initial} />;
}
