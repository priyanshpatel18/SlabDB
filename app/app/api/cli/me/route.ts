import { handleCliMe } from "@/lib/cli-api";
import { cliIdentity } from "@/lib/cli-session";
import { privyServerConfigured } from "@/lib/privy-server";

export const runtime = "nodejs";

export async function GET(req: Request) {
  return handleCliMe(req, {
    privyReady: privyServerConfigured,
    identity: cliIdentity,
  });
}
