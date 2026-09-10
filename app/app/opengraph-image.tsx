import { OG_SIZE, OG_TYPE, renderDefaultOgImage } from "@/lib/og";

export const runtime = "nodejs";
export const alt = "Slab: onchain GitHub. Profiles, repos, and README on Solana.";
export const size = OG_SIZE;
export const contentType = OG_TYPE;

export default async function OpenGraphImage() {
  return renderDefaultOgImage();
}
