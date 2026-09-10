import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { CommitView } from "@/components/commit-view";
import { HOME_REPO, isReservedUsername, profilePath } from "@/lib/cluster";
import { normalizeRepoName, parseRepoParam } from "@/lib/files";
import { getSEOTags } from "@/lib/seo";
import {
  isUsernameFormat,
  normalizeUsername,
} from "@/lib/username-lookup";

type CommitParams = { username: string; repo: string; id: string };

const COMMIT_ID = /^[a-f0-9]{8}$/;

export async function generateMetadata({
  params,
}: {
  params: Promise<CommitParams>;
}): Promise<Metadata> {
  const { username, repo: rawRepo, id } = await params;
  const uid = normalizeUsername(username);
  const repo = parseRepoParam(rawRepo);
  if (!isUsernameFormat(uid) || isReservedUsername(uid) || !repo || !COMMIT_ID.test(id)) {
    return getSEOTags({ title: "Not found", canonicalUrlRelative: "/" });
  }
  return getSEOTags({
    title: `${id} · ${uid}/${repo}`,
    description: `Commit ${id} in ${uid}/${repo}.`,
    canonicalUrlRelative: `/${uid}/${repo}/commit/${id}`,
  });
}

export default async function CommitPage({
  params,
}: {
  params: Promise<CommitParams>;
}) {
  const { username, repo: rawRepo, id } = await params;
  const uid = normalizeUsername(username);
  const repoName = normalizeRepoName(rawRepo);
  if (!isUsernameFormat(uid) || isReservedUsername(uid) || !COMMIT_ID.test(id)) {
    notFound();
  }
  if (repoName === HOME_REPO) {
    redirect(profilePath(uid));
  }
  const repo = parseRepoParam(repoName);
  if (!repo) {
    notFound();
  }
  return <CommitView uid={uid} repo={repo} id={id} />;
}
