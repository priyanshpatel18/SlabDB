import { privyServer, privyServerConfigured } from "@/lib/privy-server";
import {
  lookupUsernameRemote,
  lookupWalletRemote,
  type PublicProfile,
} from "@/lib/username-lookup";

export type CliIdentity = {
  userId: string;
  walletId: string;
  wallet: string;
  profile: PublicProfile;
};

type PrivyWalletRow = {
  id?: string;
  address?: string;
  chain_type?: string;
  chainType?: string;
  wallet_client_type?: string;
  walletClientType?: string;
};

function bearer(req: Request): string {
  const header = req.headers.get("authorization") ?? "";
  return header.startsWith("Bearer ") ? header.slice(7).trim() : "";
}

function isSolanaWallet(row: PrivyWalletRow): boolean {
  const chain = (row.chain_type || row.chainType || "").toLowerCase();
  if (chain.includes("solana")) {
    return true;
  }
  const address = row.address ?? "";
  return Boolean(address) && !address.startsWith("0x");
}

function isPrivyEmbedded(row: PrivyWalletRow): boolean {
  const client = (row.wallet_client_type || row.walletClientType || "").toLowerCase();
  return client === "privy" || client === "privy-v2" || client.includes("privy");
}

export async function cliIdentity(req: Request): Promise<CliIdentity> {
  if (!privyServerConfigured()) {
    throw Object.assign(new Error("CLI push is not configured"), { status: 503 });
  }
  const token = bearer(req);
  if (!token) {
    throw Object.assign(new Error("Missing Slab login token"), { status: 401 });
  }
  const privy = privyServer();
  const claims = await privy.utils().auth().verifyAccessToken(token);
  const wallets = await privy.wallets().list({ user_id: claims.user_id });
  const solanaWallets: PrivyWalletRow[] = [];
  for await (const wallet of wallets) {
    const row = wallet as PrivyWalletRow;
    if (isSolanaWallet(row) && row.id && row.address) {
      solanaWallets.push(row);
    }
  }
  const solana =
    solanaWallets.find(isPrivyEmbedded) ?? solanaWallets[0] ?? null;
  if (!solana?.id || !solana.address) {
    throw Object.assign(new Error("No Solana wallet on this Slab login"), {
      status: 403,
    });
  }
  const profile = await lookupWalletRemote(solana.address);
  if (!profile) {
    throw Object.assign(
      new Error("Claim a Slab username on the site before you push"),
      { status: 403 }
    );
  }
  return {
    userId: claims.user_id,
    walletId: solana.id,
    wallet: solana.address,
    profile,
  };
}

export async function assertOwnsRepo(
  identity: CliIdentity,
  uid: string
): Promise<PublicProfile> {
  const profile = await lookupUsernameRemote(uid);
  if (!profile || profile.wallet !== identity.wallet) {
    throw Object.assign(
      new Error("You can only push to a repository you own"),
      { status: 403 }
    );
  }
  return profile;
}
