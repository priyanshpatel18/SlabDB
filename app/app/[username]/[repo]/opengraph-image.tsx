import { OG_SIZE, OG_TYPE, renderOgImage } from "@/lib/og";
import { isReservedUsername } from "@/lib/cluster";
import { parseRepoParam } from "@/lib/files";
import {
  isUsernameFormat,
  normalizeUsername,
} from "@/lib/username-lookup";

export const runtime = "nodejs";
export const revalidate = 60;
export const alt = "Slab repository";
export const size = OG_SIZE;
export const contentType = OG_TYPE;

export default async function OpenGraphImage({
  params,
}: {
  params: Promise<{ username: string; repo: string }>;
}) {
  const { username, repo: rawRepo } = await params;
  const uid = normalizeUsername(username);
  const repo = parseRepoParam(rawRepo);
  if (!isUsernameFormat(uid) || isReservedUsername(uid) || !repo) {
    return renderOgImage({
      kicker: "Slab",
      title: "Repository not found.",
      footer: "MagicBlock ER  ·  Irys pages",
    });
  }
  return renderOgImage({
    kicker: `${uid} / ${repo}`,
    title: `Files in ${repo}.`,
    footer: "Onchain GitHub  ·  MagicBlock ER",
  });
}
