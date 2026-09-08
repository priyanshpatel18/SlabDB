import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
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
            width: 20,
            height: 12,
            marginTop: 2,
            backgroundColor: "#d4a574",
          }}
        />
      </div>
    ),
    size,
  );
}
