import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { KILN_BG, KILN_COPPER, WORDMARK_CREAM } from "@/lib/brand";
import { IRYS_GATEWAY } from "@/lib/cluster";

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

export const DEFAULT_OG_COPY = {
  kicker: "Onchain GitHub",
  title: "Profiles, repos, and README on Solana.",
  footer: "MagicBlock ER  ·  Irys pages",
} as const;

export function renderDefaultOgImage() {
  return renderOgImage({ ...DEFAULT_OG_COPY });
}

function pfpUrl(id: string): string {
  const raw = id.trim();
  if (!raw) {
    return "";
  }
  if (/^https?:\/\//i.test(raw)) {
    return raw;
  }
  return `${IRYS_GATEWAY.replace(/\/$/, "")}/${raw}`;
}

async function loadPfpData(id: string): Promise<string | null> {
  const url = pfpUrl(id);
  if (!url) {
    return null;
  }
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(5_000),
      next: { revalidate: 60 },
    } as RequestInit);
    if (!res.ok) {
      return null;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength < 32 || buf.byteLength > 2_000_000) {
      return null;
    }
    const type = (res.headers.get("content-type") || "image/png").split(";")[0];
    if (!/^image\/(png|jpe?g|webp|gif)$/i.test(type)) {
      return null;
    }
    return `data:${type};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

function clip(text: string, max: number): string {
  const value = text.trim().replace(/\s+/g, " ");
  if (value.length <= max) {
    return value;
  }
  return `${value.slice(0, max - 3).trimEnd()}...`;
}

const MARK_SM = 56;
const WORDMARK_SM_H = 48;
const WORDMARK_SM_W = Math.round(WORDMARK_SM_H * (1991 / 790));
const PFP_PX = 280;

type ProfileOgProps = {
  uid: string;
  name: string;
  bio: string;
  pfpSrc: string | null;
  logoSrc: string;
  wordmarkSrc: string;
};

function ProfileOgCard({
  uid,
  name,
  bio,
  pfpSrc,
  logoSrc,
  wordmarkSrc,
}: ProfileOgProps) {
  const letter = (name.trim() || uid).slice(0, 1).toUpperCase();
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "56px 72px",
        backgroundColor: KILN_BG,
        backgroundImage:
          "linear-gradient(to right, rgba(232,144,88,0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(232,144,88,0.08) 1px, transparent 1px)",
        backgroundSize: "64px 64px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          marginLeft: -8,
        }}
      >
        <img
          alt=""
          src={logoSrc}
          width={MARK_SM}
          height={MARK_SM}
          style={{ objectFit: "contain" }}
        />
        <img
          alt="Slab"
          src={wordmarkSrc}
          width={WORDMARK_SM_W}
          height={WORDMARK_SM_H}
          style={{ objectFit: "contain", marginLeft: -10 }}
        />
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          marginTop: 28,
        }}
      >
        <div
          style={{
            display: "flex",
            width: PFP_PX,
            height: PFP_PX,
            borderRadius: PFP_PX / 2,
            overflow: "hidden",
            backgroundColor: "#3d3228",
            border: "3px solid rgba(232,144,88,0.35)",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {pfpSrc ? (
            <img
              alt=""
              src={pfpSrc}
              width={PFP_PX}
              height={PFP_PX}
              style={{ objectFit: "cover" }}
            />
          ) : (
            <div
              style={{
                display: "flex",
                fontFamily: "Slab Sans",
                fontSize: 108,
                color: WORDMARK_CREAM,
              }}
            >
              {letter}
            </div>
          )}
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            marginLeft: 48,
            width: 680,
          }}
        >
          <div
            style={{
              display: "flex",
              fontFamily: "Slab Sans",
              fontSize: 52,
              lineHeight: 1.15,
              color: WORDMARK_CREAM,
            }}
          >
            {clip(name, 42)}
          </div>
          <div
            style={{
              display: "flex",
              marginTop: 8,
              fontFamily: "Slab Sans",
              fontSize: 32,
              color: "#c4a894",
            }}
          >
            @{uid}
          </div>
          {bio ? (
            <div
              style={{
                display: "flex",
                marginTop: 18,
                fontFamily: "Slab Sans",
                fontSize: 26,
                lineHeight: 1.35,
                color: WORDMARK_CREAM,
              }}
            >
              {clip(bio, 140)}
            </div>
          ) : null}
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
        /{uid}
      </div>
    </div>
  );
}

export async function renderProfileOgImage(profile: {
  uid: string;
  name: string;
  bio: string;
  pfp: string;
}) {
  const [fonts, logoSrc, wordmarkSrc, pfpSrc] = await Promise.all([
    loadOgFonts(),
    loadBrandSrc("logo.png"),
    loadBrandSrc("wordmark.png"),
    loadPfpData(profile.pfp),
  ]);
  return new ImageResponse(
    <ProfileOgCard
      uid={profile.uid}
      name={profile.name || profile.uid}
      bio={profile.bio}
      pfpSrc={pfpSrc}
      logoSrc={logoSrc}
      wordmarkSrc={wordmarkSrc}
    />,
    {
      ...OG_SIZE,
      fonts,
    },
  );
}
