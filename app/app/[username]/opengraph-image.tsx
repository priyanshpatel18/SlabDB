import { isReservedUsername } from "@/lib/cluster";
import {
  OG_SIZE,
  OG_TYPE,
  renderDefaultOgImage,
  renderProfileOgImage,
} from "@/lib/og";
import {
  isUsernameFormat,
  lookupUsernameRemote,
  normalizeUsername,
} from "@/lib/username-lookup";

export const runtime = "nodejs";
export const revalidate = 60;
export const alt = "Slab profile";
export const size = OG_SIZE;
export const contentType = OG_TYPE;

export default async function OpenGraphImage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const uid = normalizeUsername(username);
  if (!isUsernameFormat(uid) || isReservedUsername(uid)) {
    return renderDefaultOgImage();
  }
  try {
    const profile = await lookupUsernameRemote(uid);
    if (!profile) {
      return renderDefaultOgImage();
    }
    return renderProfileOgImage(profile);
  } catch {
    return renderDefaultOgImage();
  }
}
