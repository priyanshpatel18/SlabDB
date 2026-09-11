import {
  ConnectionMagicRouter,
  DelegationStatus,
  getDelegationRecord,
} from "@magicblock-labs/ephemeral-rollups-sdk";
import { Connection, PublicKey } from "@solana/web3.js";
import {
  DEFAULT_ER_ROUTER,
  DEFAULT_ER_URL,
  DEFAULT_ER_WS,
  SLAB_PROGRAM_ID,
} from "./config";
import type { Remaining } from "./db";

export type ErTarget = {
  erUrl: string;
  remainingAccounts: Remaining[];
};

export type ErIdentity = {
  url: string;
  identity: string;
  fqdn?: string;
};

export const ER_ENDPOINT_CANDIDATES = [
  DEFAULT_ER_URL,
  "https://devnet-eu.magicblock.app/",
  "https://devnet-na.magicblock.app/",
];

export function normalizeErUrl(url: string): string {
  return `${url.replace(/\/+$/, "")}/`;
}

export function remainingForValidator(identity: PublicKey): Remaining[] {
  return [
    {
      pubkey: identity,
      isSigner: false,
      isWritable: false,
    },
  ];
}

export function pickErUrl(want: string, probed: ErIdentity[]): string | null {
  for (const row of probed) {
    if (row.identity === want) {
      return normalizeErUrl(row.fqdn || row.url);
    }
  }
  return null;
}

function isForbiddenErRpc(url: string): boolean {
  try {
    return new URL(url).hostname === "devnet.magicblock.app";
  } catch {
    return false;
  }
}

function assertErUrl(url: string): string {
  const erUrl = normalizeErUrl(url);
  if (isForbiddenErRpc(erUrl)) {
    throw new Error(
      "Refusing https://devnet.magicblock.app/ as validator RPC. Use the closest validator FQDN."
    );
  }
  return erUrl;
}

export function slabPdaFor(
  owner: PublicKey,
  ns: number[],
  programId: PublicKey = new PublicKey(SLAB_PROGRAM_ID)
): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("slab"), owner.toBuffer(), Buffer.from(ns)],
    programId
  )[0];
}

export async function fetchErIdentity(url: string): Promise<ErIdentity | null> {
  try {
    const res = await fetch(normalizeErUrl(url), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getIdentity",
        params: [],
      }),
      signal: AbortSignal.timeout(4000),
    });
    const data = (await res.json()) as {
      result?: { identity?: string; fqdn?: string };
    };
    const identity = data.result?.identity;
    if (typeof identity !== "string" || !identity) {
      return null;
    }
    const fqdn =
      typeof data.result?.fqdn === "string" ? data.result.fqdn : undefined;
    return { url: normalizeErUrl(url), identity, fqdn };
  } catch {
    return null;
  }
}

async function probeEndpoints(urls: string[]): Promise<ErIdentity[]> {
  const unique = [...new Set(urls.map(normalizeErUrl))];
  const rows = await Promise.all(unique.map((url) => fetchErIdentity(url)));
  return rows.filter((row): row is ErIdentity => Boolean(row));
}

export async function resolveErTarget(opts?: {
  router?: string;
  ws?: string;
  validator?: PublicKey;
}): Promise<ErTarget> {
  const routerUrl = opts?.router ?? DEFAULT_ER_ROUTER;
  const router = new ConnectionMagicRouter(routerUrl, {
    wsEndpoint: opts?.ws ?? DEFAULT_ER_WS,
    commitment: "confirmed",
  });
  const closest = await router.getClosestValidator();
  if (!closest.identity) {
    throw new Error("ER router returned no validator identity");
  }
  if (opts?.validator) {
    const want = opts.validator.toBase58();
    if (closest.identity === want) {
      return {
        erUrl: assertErUrl(closest.fqdn || DEFAULT_ER_URL),
        remainingAccounts: remainingForValidator(opts.validator),
      };
    }
    const probed = await probeEndpoints([
      closest.fqdn || DEFAULT_ER_URL,
      ...ER_ENDPOINT_CANDIDATES,
    ]);
    const erUrl = pickErUrl(want, probed);
    if (erUrl) {
      return {
        erUrl: assertErUrl(erUrl),
        remainingAccounts: remainingForValidator(opts.validator),
      };
    }
    throw new Error(`No ER endpoint for validator ${want}`);
  }
  return {
    erUrl: assertErUrl(closest.fqdn || DEFAULT_ER_URL),
    remainingAccounts: remainingForValidator(new PublicKey(closest.identity)),
  };
}

export async function resolveErTargetForSlab(opts: {
  base: Connection;
  owner: PublicKey;
  ns: number[];
  router?: string;
  ws?: string;
}): Promise<ErTarget> {
  const slab = slabPdaFor(opts.owner, opts.ns);
  const record = await getDelegationRecord(opts.base, slab);
  if (record.status === DelegationStatus.Delegated) {
    return resolveErTarget({
      router: opts.router,
      ws: opts.ws,
      validator: record.validator,
    });
  }
  return resolveErTarget({ router: opts.router, ws: opts.ws });
}
