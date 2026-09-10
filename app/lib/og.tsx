import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { KILN_BG, KILN_COPPER, WORDMARK_CREAM } from "@/lib/brand";

/* eslint-disable @next/next/no-img-element */

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_TYPE = "image/png";

export async function loadOgFonts() {
  const dir = join(process.cwd(), "lib/fonts");
  const sans = await readFile(join(dir, "IBMPlexSans-Medium.ttf"));
  return [
    {
      name: "Slab Sans",
      data: sans,
      weight: 500 as const,
      style: "normal" as const,
    },
  ];
}

async function loadBrandSrc(name: "logo.png" | "wordmark.png") {
  const data = await readFile(join(process.cwd(), "public", name));
  return `data:image/png;base64,${data.toString("base64")}`;
}

const LOGO_PX = 200;
const WORDMARK_H = 168;
const WORDMARK_W = Math.round(WORDMARK_H * (1991 / 790));

type OgCardProps = {
  kicker: string;
  title: string;
  footer: string;
  logoSrc: string;
  wordmarkSrc: string;
};

export function OgCard({
  kicker,
  title,
  footer,
  logoSrc,
  wordmarkSrc,
}: OgCardProps) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "72px 80px",
        backgroundColor: KILN_BG,
        backgroundImage:
          "linear-gradient(to right, rgba(232,144,88,0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(232,144,88,0.08) 1px, transparent 1px)",
        backgroundSize: "64px 64px",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div
          style={{
            display: "flex",
            fontFamily: "Slab Sans",
            fontSize: 22,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "#c4a894",
          }}
        >
          {kicker}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            marginTop: 28,
            marginLeft: -12,
          }}
        >
          <img
            alt=""
            src={logoSrc}
            width={LOGO_PX}
            height={LOGO_PX}
            style={{ objectFit: "contain" }}
          />
          <img
            alt="Slab"
            src={wordmarkSrc}
            width={WORDMARK_W}
            height={WORDMARK_H}
            style={{ objectFit: "contain", marginLeft: -28 }}
          />
        </div>
        <div
          style={{
            width: 220,
            height: 4,
            marginTop: 8,
            backgroundColor: KILN_COPPER,
          }}
        />
        <div
          style={{
            display: "flex",
            marginTop: 32,
            maxWidth: 920,
            fontFamily: "Slab Sans",
            fontSize: 36,
            lineHeight: 1.25,
            color: WORDMARK_CREAM,
          }}
        >
          {title}
        </div>
      </div>
      <div
        style={{
          display: "flex",
          fontFamily: "Slab Sans",
          fontSize: 22,
          color: "#c4a894",
        }}
      >
        {footer}
      </div>
    </div>
  );
}

export async function renderOgImage(props: Omit<OgCardProps, "logoSrc" | "wordmarkSrc">) {
  const [fonts, logoSrc, wordmarkSrc] = await Promise.all([
    loadOgFonts(),
    loadBrandSrc("logo.png"),
    loadBrandSrc("wordmark.png"),
  ]);
  return new ImageResponse(
    <OgCard {...props} logoSrc={logoSrc} wordmarkSrc={wordmarkSrc} />,
    {
      ...OG_SIZE,
      fonts,
    },
  );
}
