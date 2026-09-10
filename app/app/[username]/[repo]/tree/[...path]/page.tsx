import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { RepoView } from "@/components/repo-view";
import { HOME_REPO, isReservedUsername, profilePath } from "@/lib/cluster";
import {
  decodeRepoPath,
  normalizeRepoName,
  parseRepoParam,
} from "@/lib/files";
import { getSEOTags } from "@/lib/seo";
import {
  isUsernameFormat,
  normalizeUsername,
} from "@/lib/username-lookup";

type TreeParams = { username: string; repo: string; path: string[] };

export async function generateMetadata({
  params,
}: {
  params: Promise<TreeParams>;
}): Promise<Metadata> {
  const { username, repo: rawRepo, path } = await params;
  const uid = normalizeUsername(username);
  const repo = parseRepoParam(rawRepo);
  const dir = decodeRepoPath(path);
  if (!isUsernameFormat(uid) || isReservedUsername(uid) || !repo) {
    return getSEOTags({ title: "Not found", canonicalUrlRelative: "/" });
  }
  return getSEOTags({
    title: `${uid}/${repo}/${dir}`,
    description: `Folder ${dir} in ${uid}/${repo}.`,
    canonicalUrlRelative: `/${uid}/${repo}/tree/${dir}`,
  });
}

export default async function TreePage({
  params,
}: {
  params: Promise<TreeParams>;
}) {
  const { username, repo: rawRepo, path } = await params;
  const uid = normalizeUsername(username);
  const repoName = normalizeRepoName(rawRepo);
  if (!isUsernameFormat(uid) || isReservedUsername(uid)) {
    notFound();
  }
  if (repoName === HOME_REPO) {
    redirect(profilePath(uid));
  }
  const repo = parseRepoParam(repoName);
  const dir = decodeRepoPath(path);
  if (!repo || !dir) {
    notFound();
  }
  return <RepoView uid={uid} repo={repo} dir={dir} />;
}
