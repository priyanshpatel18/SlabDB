import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { SettingsView } from "@/components/settings-view";
import { HOME_REPO, isReservedUsername, profilePath } from "@/lib/cluster";
import { normalizeRepoName, parseRepoParam } from "@/lib/files";
import { getSEOTags } from "@/lib/seo";
import {
  isUsernameFormat,
  normalizeUsername,
} from "@/lib/username-lookup";

type SettingsParams = { username: string; repo: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<SettingsParams>;
}): Promise<Metadata> {
  const { username, repo: rawRepo } = await params;
  const uid = normalizeUsername(username);
  const repo = parseRepoParam(rawRepo);
  if (!isUsernameFormat(uid) || isReservedUsername(uid) || !repo) {
    return getSEOTags({ title: "Not found", canonicalUrlRelative: "/" });
  }
  return getSEOTags({
    title: `Settings · ${uid}/${repo}`,
    description: `Settings for ${uid}/${repo}.`,
    canonicalUrlRelative: `/${uid}/${repo}/settings`,
  });
}

export default async function RepoSettingsPage({
  params,
}: {
  params: Promise<SettingsParams>;
}) {
  const { username, repo: rawRepo } = await params;
  const uid = normalizeUsername(username);
  const repoName = normalizeRepoName(rawRepo);
  if (!isUsernameFormat(uid) || isReservedUsername(uid)) {
    notFound();
  }
  if (repoName === HOME_REPO) {
    redirect(profilePath(uid));
  }
  const repo = parseRepoParam(repoName);
  if (!repo) {
    notFound();
  }
  return <SettingsView uid={uid} repo={repo} />;
}
