import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { NewFile } from "@/components/new-file";
import { HOME_REPO, isReservedUsername, profilePath } from "@/lib/cluster";
import { normalizeRepoName, parseRepoParam } from "@/lib/files";
import { getSEOTags } from "@/lib/seo";
import {
  isUsernameFormat,
  normalizeUsername,
} from "@/lib/username-lookup";

type NewFileParams = { username: string; repo: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<NewFileParams>;
}): Promise<Metadata> {
  const { username, repo: rawRepo } = await params;
  const uid = normalizeUsername(username);
  const repo = parseRepoParam(rawRepo);
  if (!isUsernameFormat(uid) || isReservedUsername(uid) || !repo) {
    return getSEOTags({ title: "Not found", canonicalUrlRelative: "/" });
  }
  return getSEOTags({
    title: `New file · ${uid}/${repo}`,
    description: `Add a file to ${uid}/${repo}.`,
    canonicalUrlRelative: `/${uid}/${repo}/new`,
  });
}

export default async function NewFilePage({
  params,
  searchParams,
}: {
  params: Promise<NewFileParams>;
  searchParams: Promise<{ filename?: string }>;
}) {
  const { username, repo: rawRepo } = await params;
  const query = await searchParams;
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
  const initialPath =
    typeof query.filename === "string" ? query.filename : "";
  return <NewFile uid={uid} repo={repo} initialPath={initialPath} />;
}
