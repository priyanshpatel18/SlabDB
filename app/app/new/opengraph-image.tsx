import { OG_SIZE, OG_TYPE, renderOgImage } from "@/lib/og";

export const runtime = "nodejs";
export const alt = "Slab: create a new repository";
export const size = OG_SIZE;
export const contentType = OG_TYPE;

export default async function OpenGraphImage() {
  return renderOgImage({
    kicker: "New repository",
    title: "Create a repo on Slab.",
    footer: "MagicBlock ER  ·  Irys pages",
  });
}
