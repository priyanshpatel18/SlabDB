import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { KILN_BG } from "@/lib/brand";

/* eslint-disable @next/next/no-img-element */

export async function kilnIconResponse(size: number) {
  const px = Number.isFinite(size) && size > 0 ? size : 32;
  const logo = await readFile(join(process.cwd(), "public/logo.png"));
  const src = `data:image/png;base64,${logo.toString("base64")}`;
  const mark = Math.round(px * 0.86);
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: KILN_BG,
        }}
      >
        <img alt="" src={src} width={mark} height={mark} />
      </div>
    ),
    { width: px, height: px },
  );
}
