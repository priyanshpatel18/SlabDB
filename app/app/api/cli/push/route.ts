import { handleCliPush } from "@/lib/cli-api";
import { applyCliPush } from "@/lib/cli-apply";
import { assertOwnsRepo, cliIdentity } from "@/lib/cli-session";
import { privyServerConfigured } from "@/lib/privy-server";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: Request) {
  return handleCliPush(req, {
    privyReady: privyServerConfigured,
    identity: cliIdentity,
    assertOwns: assertOwnsRepo,
    applyPush: applyCliPush,
  });
}
