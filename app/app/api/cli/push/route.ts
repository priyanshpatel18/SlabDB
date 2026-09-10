import { handleCliPush } from "@/lib/cli-api";
import { applyCliPush } from "@/lib/cli-apply";
import { assertOwnsRepo, cliIdentity } from "@/lib/cli-session";
import { privyServerConfigured } from "@/lib/privy-server";
import { irysStoreReady } from "@/lib/server-irys-store";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: Request) {
  return handleCliPush(req, {
    privyReady: privyServerConfigured,
    irysReady: irysStoreReady,
    identity: cliIdentity,
    assertOwns: assertOwnsRepo,
    applyPush: applyCliPush,
  });
}
