import { OG_SIZE, OG_TYPE, renderOgImage } from "@/lib/og";

export const runtime = "nodejs";
export const alt = "Slab: onchain GitHub. Profiles, repos, and README on Solana.";
export const size = OG_SIZE;
export const contentType = OG_TYPE;

export default async function OpenGraphImage() {
  return renderOgImage({
    kicker: "Onchain GitHub",
    title: "Profiles, repos, and README on Solana.",
    footer: "MagicBlock ER  ·  Irys pages",
  });
}
