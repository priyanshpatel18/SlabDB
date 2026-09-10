import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { BlobView } from "@/components/blob-view";
import { HOME_REPO, isReservedUsername, profilePath } from "@/lib/cluster";
import {
  assertFilePath,
  decodeRepoPath,
  normalizeRepoName,
  parseRepoParam,
} from "@/lib/files";
import { getSEOTags } from "@/lib/seo";
import {
  isUsernameFormat,
  normalizeUsername,
} from "@/lib/username-lookup";

type BlobParams = { username: string; repo: string; path: string[] };

export async function generateMetadata({
  params,
}: {
  params: Promise<BlobParams>;
}): Promise<Metadata> {
  const { username, repo: rawRepo, path } = await params;
  const uid = normalizeUsername(username);
  const repo = parseRepoParam(rawRepo);
  const file = decodeRepoPath(path);
  if (!isUsernameFormat(uid) || isReservedUsername(uid) || !repo) {
    return getSEOTags({ title: "Not found", canonicalUrlRelative: "/" });
  }
  return getSEOTags({
    title: `${file} · ${uid}/${repo}`,
    description: `${file} in ${uid}/${repo} on Slab.`,
    canonicalUrlRelative: `/${uid}/${repo}/blob/${file}`,
  });
}

export default async function BlobPage({
  params,
}: {
  params: Promise<BlobParams>;
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
  if (!repo) {
    notFound();
  }
  let file: string;
  try {
    file = assertFilePath(decodeRepoPath(path));
  } catch {
    notFound();
  }
  return <BlobView uid={uid} repo={repo} path={file} />;
}
