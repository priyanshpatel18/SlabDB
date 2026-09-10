import { NextResponse } from "next/server";
import { applyCliPush, parseCliPush } from "@/lib/cli-apply";
import { assertOwnsRepo, cliIdentity } from "@/lib/cli-session";
import { privyServerConfigured } from "@/lib/privy-server";
import { irysStoreReady } from "@/lib/server-irys-store";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: Request) {
  if (!privyServerConfigured() || !irysStoreReady()) {
    return NextResponse.json(
      { error: "CLI push is not configured on the server" },
      { status: 503 }
    );
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  try {
    const packed = parseCliPush(body);
    const identity = await cliIdentity(req);
    if (packed.uid !== identity.profile.uid) {
      throw Object.assign(
        new Error("You can only push to a repository you own"),
        { status: 403 }
      );
    }
    await assertOwnsRepo(identity, packed.uid);
    if (packed.commit.author && packed.commit.author !== identity.profile.uid) {
      packed.commit.author = identity.profile.uid;
    }
    if (!packed.commit.author) {
      packed.commit.author = identity.profile.uid;
    }
    const result = await applyCliPush({
      walletId: identity.walletId,
      wallet: identity.wallet,
      repo: packed.repo,
      commit: packed.commit,
    });
    return NextResponse.json({
      ok: true,
      wrote: result.wrote,
      id: result.id,
      uid: packed.uid,
      repo: packed.repo,
    });
  } catch (err) {
    const status = (err as { status?: number }).status ?? 400;
    const msg = err instanceof Error ? err.message : "CLI push failed";
    return NextResponse.json({ error: msg }, { status });
  }
}
