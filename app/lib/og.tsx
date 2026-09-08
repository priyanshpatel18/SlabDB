import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_TYPE = "image/png";

export async function loadOgFonts() {
  const dir = join(process.cwd(), "lib/fonts");
  const [sans, display] = await Promise.all([
    readFile(join(dir, "IBMPlexSans-Medium.ttf")),
    readFile(join(dir, "Newsreader-Italic.ttf")),
  ]);
  return [
    {
      name: "IBM Plex Sans",
      data: sans,
      weight: 500 as const,
      style: "normal" as const,
    },
    {
      name: "Newsreader",
      data: display,
      weight: 500 as const,
      style: "italic" as const,
    },
  ];
}

type OgCardProps = {
  kicker: string;
  title: string;
  footer: string;
};

export function OgCard({ kicker, title, footer }: OgCardProps) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "72px 80px",
        backgroundColor: "#2c241c",
        backgroundImage:
          "linear-gradient(to right, rgba(212,165,116,0.07) 1px, transparent 1px), linear-gradient(to bottom, rgba(212,165,116,0.07) 1px, transparent 1px)",
        backgroundSize: "64px 64px",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div
          style={{
            display: "flex",
            fontFamily: "IBM Plex Sans",
            fontSize: 22,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "#a89888",
          }}
        >
          {kicker}
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 28,
            fontFamily: "Newsreader",
            fontSize: 92,
            fontStyle: "italic",
            lineHeight: 0.95,
            color: "#f0ebe4",
          }}
        >
          Slab
        </div>
        <div
          style={{
            width: 168,
            height: 3,
            marginTop: 12,
            backgroundColor: "#d4a574",
          }}
        />
        <div
          style={{
            display: "flex",
            marginTop: 36,
            maxWidth: 860,
            fontFamily: "IBM Plex Sans",
            fontSize: 40,
            lineHeight: 1.2,
            color: "#f0ebe4",
          }}
        >
          {title}
        </div>
      </div>
      <div
        style={{
          display: "flex",
          fontFamily: "IBM Plex Sans",
          fontSize: 22,
          color: "#a89888",
        }}
      >
        {footer}
      </div>
    </div>
  );
}

export async function renderOgImage(props: OgCardProps) {
  const fonts = await loadOgFonts();
  return new ImageResponse(<OgCard {...props} />, {
    ...OG_SIZE,
    fonts,
  });
}
