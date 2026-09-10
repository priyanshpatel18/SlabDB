import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { RepoView } from "@/components/repo-view";
import { HOME_REPO, isReservedUsername, profilePath } from "@/lib/cluster";
import { normalizeRepoName, parseRepoParam } from "@/lib/files";
import { loadRepoShare, repoShareSeo } from "@/lib/repo-share";
import { absoluteUrl, getSEOTags } from "@/lib/seo";
import {
  isUsernameFormat,
  normalizeUsername,
} from "@/lib/username-lookup";

type RepoParams = { username: string; repo: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<RepoParams>;
}): Promise<Metadata> {
  const { username, repo: rawRepo } = await params;
  const uid = normalizeUsername(username);
  const repo = parseRepoParam(rawRepo);
  if (!isUsernameFormat(uid) || isReservedUsername(uid) || !repo) {
    return getSEOTags({ title: "Not found", canonicalUrlRelative: "/" });
  }
  let share = null;
  try {
    share = await loadRepoShare(uid, repo);
  } catch {
    share = null;
  }
  const copy = repoShareSeo(share, uid, repo);
  return getSEOTags({
    title: copy.title,
    description: copy.description,
    canonicalUrlRelative: `/${uid}/${repo}`,
    openGraph: {
      title: copy.title,
      description: copy.description,
      images: [
        {
          url: absoluteUrl(`/${uid}/${repo}/opengraph-image`),
          width: 1200,
          height: 630,
          alt: `${uid}/${repo}`,
          type: "image/png",
        },
      ],
    },
  });
}

export default async function RepoPage({
  params,
}: {
  params: Promise<RepoParams>;
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
  return <RepoView uid={uid} repo={repo} />;
}
