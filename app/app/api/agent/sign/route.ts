import { NextResponse } from "next/server";
import {
  authorizationKey,
  privyServer,
  privyServerConfigured,
} from "@/lib/privy-server";

export const runtime = "nodejs";

type Body = {
  walletId?: string;
  transaction?: string;
};

export async function POST(req: Request) {
  if (!privyServerConfigured()) {
    return NextResponse.json(
      { error: "Agent signing is not configured on the server" },
      { status: 503 }
    );
  }
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) {
    return NextResponse.json({ error: "Missing Privy token" }, { status: 401 });
  }
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.walletId || !body.transaction) {
    return NextResponse.json(
      { error: "walletId and transaction are required" },
      { status: 400 }
    );
  }

  const privy = privyServer();
  try {
    const claims = await privy.utils().auth().verifyAccessToken(token);
    const wallets = await privy.wallets().list({ user_id: claims.user_id });
    let owned = false;
    for await (const wallet of wallets) {
      if (wallet.id === body.walletId) {
        owned = true;
        break;
      }
    }
    if (!owned) {
      return NextResponse.json(
        { error: "Wallet is not owned by this user" },
        { status: 403 }
      );
    }
    const signed = await privy.wallets().solana().signTransaction(body.walletId, {
      transaction: body.transaction,
      authorization_context: {
        authorization_private_keys: [authorizationKey()],
      },
    });
    return NextResponse.json({ signed: signed.signed_transaction });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Agent sign failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
