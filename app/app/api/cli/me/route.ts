import { NextResponse } from "next/server";
import { cliIdentity } from "@/lib/cli-session";
import { privyServerConfigured } from "@/lib/privy-server";

export const runtime = "nodejs";

export async function GET(req: Request) {
  if (!privyServerConfigured()) {
    return NextResponse.json(
      { error: "CLI login is not configured" },
      { status: 503 }
    );
  }
  try {
    const identity = await cliIdentity(req);
    return NextResponse.json({
      uid: identity.profile.uid,
      name: identity.profile.name,
      wallet: identity.wallet,
      walletId: identity.walletId,
    });
  } catch (err) {
    const status = (err as { status?: number }).status ?? 400;
    const msg = err instanceof Error ? err.message : "CLI login failed";
    return NextResponse.json({ error: msg }, { status });
  }
}
