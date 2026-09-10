import { OG_SIZE, OG_TYPE, renderOgImage } from "@/lib/og";

export const runtime = "nodejs";
export const alt = "Slab console: SQL workstation for onchain GitHub";
export const size = OG_SIZE;
export const contentType = OG_TYPE;

export default async function OpenGraphImage() {
  return renderOgImage({
    kicker: "Console",
    title: "SQL workstation for onchain GitHub.",
    footer: "base + public ER  ·  Irys pages",
  });
}
