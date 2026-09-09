import { kilnIconResponse } from "@/lib/kiln-mark";

export function generateImageMetadata() {
  return [
    {
      id: "32",
      size: { width: 32, height: 32 },
      contentType: "image/png" as const,
    },
    {
      id: "192",
      size: { width: 192, height: 192 },
      contentType: "image/png" as const,
    },
    {
      id: "512",
      size: { width: 512, height: 512 },
      contentType: "image/png" as const,
    },
  ];
}

export default async function Icon({ id }: { id: Promise<string> }) {
  const imageId = Number(await id);
  return kilnIconResponse(imageId);
}
