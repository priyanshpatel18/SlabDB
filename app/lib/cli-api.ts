import { NextResponse } from "next/server";
import type { CliIdentity } from "@/lib/cli-session";
import {
  parseCliPush,
  type CliPushCommit,
} from "@/lib/cli-push";

export type CliMeDeps = {
  privyReady: () => boolean;
  identity: (req: Request) => Promise<CliIdentity>;
};

export type CliPushDeps = {
  privyReady: () => boolean;
  identity: (req: Request) => Promise<CliIdentity>;
  assertOwns: (identity: CliIdentity, uid: string) => Promise<unknown>;
  applyPush: (opts: {
    walletId: string;
    wallet: string;
    repo: string;
    commit: CliPushCommit;
  }) => Promise<{ wrote: number; id: string }>;
};

function errorResponse(err: unknown, fallback: string): NextResponse {
  const status = (err as { status?: number }).status ?? 400;
  const msg = err instanceof Error ? err.message : fallback;
  return NextResponse.json({ error: msg }, { status });
}

export async function handleCliMe(
  req: Request,
  deps: CliMeDeps
): Promise<NextResponse> {
  if (!deps.privyReady()) {
    return NextResponse.json(
      { error: "CLI login is not configured" },
      { status: 503 }
    );
  }
  try {
    const identity = await deps.identity(req);
    return NextResponse.json({
      uid: identity.profile.uid,
      name: identity.profile.name,
      wallet: identity.wallet,
      walletId: identity.walletId,
    });
  } catch (err) {
    return errorResponse(err, "CLI login failed");
  }
}

export async function handleCliPush(
  req: Request,
  deps: CliPushDeps
): Promise<NextResponse> {
  if (!deps.privyReady()) {
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
    const identity = await deps.identity(req);
    if (packed.uid !== identity.profile.uid) {
      throw Object.assign(
        new Error("You can only push to a repository you own"),
        { status: 403 }
      );
    }
    await deps.assertOwns(identity, packed.uid);
    if (packed.commit.author && packed.commit.author !== identity.profile.uid) {
      packed.commit.author = identity.profile.uid;
    }
    if (!packed.commit.author) {
      packed.commit.author = identity.profile.uid;
    }
    const result = await deps.applyPush({
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
    return errorResponse(err, "CLI push failed");
  }
}
