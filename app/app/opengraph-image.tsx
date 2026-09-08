import { OG_SIZE, OG_TYPE, renderOgImage } from "@/lib/og";

export const runtime = "nodejs";
export const alt = "Slab: SQL-native storage for onchain data";
export const size = OG_SIZE;
export const contentType = OG_TYPE;

export default async function OpenGraphImage() {
  return renderOgImage({
    kicker: "Onchain database infrastructure",
    title: "SQL-native storage for onchain data.",
    footer: "MagicBlock ER  ·  Irys pages  ·  8,192 B",
  });
}
