import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#1c1814",
        }}
      >
        <div
          style={{
            width: 112,
            height: 68,
            backgroundColor: "#d4a574",
          }}
        />
      </div>
    ),
    size,
  );
}
