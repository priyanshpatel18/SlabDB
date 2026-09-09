import { kilnIconResponse } from "@/lib/kiln-mark";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return kilnIconResponse(180);
}
