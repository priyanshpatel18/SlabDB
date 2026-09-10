import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { CommitsView } from "@/components/commits-view";
import { HOME_REPO, isReservedUsername, profilePath } from "@/lib/cluster";
import { normalizeRepoName, parseRepoParam } from "@/lib/files";
import { getSEOTags } from "@/lib/seo";
import {
  isUsernameFormat,
  normalizeUsername,
} from "@/lib/username-lookup";

type CommitsParams = { username: string; repo: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<CommitsParams>;
}): Promise<Metadata> {
  const { username, repo: rawRepo } = await params;
  const uid = normalizeUsername(username);
  const repo = parseRepoParam(rawRepo);
  if (!isUsernameFormat(uid) || isReservedUsername(uid) || !repo) {
    return getSEOTags({ title: "Not found", canonicalUrlRelative: "/" });
  }
  return getSEOTags({
    title: `Commits · ${uid}/${repo}`,
    description: `Commit history for ${uid}/${repo}.`,
    canonicalUrlRelative: `/${uid}/${repo}/commits`,
  });
}

export default async function CommitsPage({
  params,
}: {
  params: Promise<CommitsParams>;
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
  return <CommitsView uid={uid} repo={repo} />;
}
