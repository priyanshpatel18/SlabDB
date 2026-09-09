import {
  Connection,
  PublicKey,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import { BASE_RPC_URL } from "@/lib/cluster";

const TOKEN_PROGRAM = new PublicKey(
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
);
const TOKEN_2022_PROGRAM = new PublicKey(
  "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"
);
const WSOL = "So11111111111111111111111111111111111111112";
const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const USDC_DEVNET = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";

export type Holding = {
  mint: string;
  symbol: string;
  name: string;
  amount: number;
  usd: number;
};

export type ActivityItem = {
  signature: string;
  slot: number;
  err: boolean;
};

function symbolFor(mint: string, tokenSymbol?: string): { symbol: string; name: string } {
  if (mint === WSOL || mint === "native") {
    return { symbol: "SOL", name: "Solana" };
  }
  if (mint === USDC || mint === USDC_DEVNET) {
    return { symbol: "USDC", name: "USD Coin" };
  }
  if (tokenSymbol) {
    return { symbol: tokenSymbol, name: tokenSymbol };
  }
  return { symbol: mint.slice(0, 4), name: mint.slice(0, 8) };
}

async function pricesFor(mints: string[]): Promise<Map<string, number>> {
  const ids = Array.from(new Set(mints.filter(Boolean)));
  const map = new Map<string, number>();
  if (ids.length === 0) return map;
  try {
    const res = await fetch(
      `/api/wallet/prices?ids=${encodeURIComponent(ids.join(","))}`
    );
    if (!res.ok) return map;
    const body = (await res.json()) as { data?: Record<string, number> };
    for (const [mint, price] of Object.entries(body.data ?? {})) {
      if (Number.isFinite(price)) map.set(mint, price);
    }
  } catch {
    /* price feed is optional */
  }
  return map;
}

async function tokenAccounts(
  connection: Connection,
  owner: PublicKey,
  programId: PublicKey
): Promise<{ mint: string; amount: number; decimals: number }[]> {
  const res = await connection.getParsedTokenAccountsByOwner(owner, {
    programId,
  });
  const out: { mint: string; amount: number; decimals: number }[] = [];
  for (const { account } of res.value) {
    const info = (
      account.data as {
        parsed?: {
          info?: {
            mint?: string;
            tokenAmount?: { uiAmount?: number | null; decimals?: number };
          };
        };
      }
    ).parsed?.info;
    const amount = info?.tokenAmount?.uiAmount;
    if (!info?.mint || amount == null || amount <= 0) continue;
    out.push({
      mint: info.mint,
      amount,
      decimals: info.tokenAmount?.decimals ?? 0,
    });
  }
  return out;
}

export async function loadHoldings(address: string): Promise<Holding[]> {
  const owner = new PublicKey(address);
  const connection = new Connection(BASE_RPC_URL, "confirmed");
  const [lamports, spl, t22] = await Promise.all([
    connection.getBalance(owner),
    tokenAccounts(connection, owner, TOKEN_PROGRAM),
    tokenAccounts(connection, owner, TOKEN_2022_PROGRAM),
  ]);
  const tokens = [...spl, ...t22];
  const mints = [WSOL, ...tokens.map((t) => t.mint)];
  const prices = await pricesFor(mints);
  const solAmount = lamports / LAMPORTS_PER_SOL;
  const holdings: Holding[] = [
    {
      mint: "native",
      ...symbolFor("native"),
      amount: solAmount,
      usd: solAmount * (prices.get(WSOL) ?? 0),
    },
  ];
  for (const token of tokens) {
    const meta = symbolFor(token.mint);
    holdings.push({
      mint: token.mint,
      ...meta,
      amount: token.amount,
      usd: token.amount * (prices.get(token.mint) ?? 0),
    });
  }
  holdings.sort((a, b) => b.usd - a.usd || b.amount - a.amount);
  return holdings;
}

export async function loadActivity(address: string): Promise<ActivityItem[]> {
  const connection = new Connection(BASE_RPC_URL, "confirmed");
  const sigs = await connection.getSignaturesForAddress(new PublicKey(address), {
    limit: 20,
  });
  return sigs.map((s) => ({
    signature: s.signature,
    slot: s.slot,
    err: s.err != null,
  }));
}

export function formatUsd(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(Number.isFinite(n) ? n : 0);
}

export function formatQty(n: number): string {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 9,
  }).format(Number.isFinite(n) ? n : 0);
}
