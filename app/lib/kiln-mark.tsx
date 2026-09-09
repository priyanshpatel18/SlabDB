import { ImageResponse } from "next/og";

const KILN_BG = "#1c1814";
const KILN_PLATE = "#d4a574";

export function KilnMark({ size }: { size: number }) {
  const plateW = Math.round((size * 20) / 32);
  const plateH = Math.round((size * 12) / 32);
  return (
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
      <div
        style={{
          width: plateW,
          height: plateH,
          backgroundColor: KILN_PLATE,
        }}
      />
    </div>
  );
}

export function kilnIconResponse(size: number) {
  const px = Number.isFinite(size) && size > 0 ? size : 32;
  return new ImageResponse(<KilnMark size={px} />, {
    width: px,
    height: px,
  });
}
