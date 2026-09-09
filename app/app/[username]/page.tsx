import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { UserProfile } from "@/components/user-profile";
import { isReservedUsername } from "@/lib/cluster";
import { getSEOTags } from "@/lib/seo";

type UserParams = { username: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<UserParams>;
}): Promise<Metadata> {
  const { username } = await params;
  const label = decodeURIComponent(username);
  if (isReservedUsername(label)) {
    return getSEOTags({ title: "Not found", canonicalUrlRelative: "/" });
  }
  return getSEOTags({
    title: label,
    description: "Public Slab profile.",
    canonicalUrlRelative: `/${label}`,
    openGraph: { title: `${label} | Slab` },
  });
}

export default async function UsernamePage({
  params,
}: {
  params: Promise<UserParams>;
}) {
  const { username } = await params;
  const uid = decodeURIComponent(username);
  if (isReservedUsername(uid)) {
    notFound();
  }
  return <UserProfile uid={uid} />;
}
