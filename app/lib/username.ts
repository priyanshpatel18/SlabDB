"use client";

import { Buffer } from "buffer";
import { fundIrys, type StatusFn } from "slabdb/web";
import { IRYS_GATEWAY, IRYS_RPC_URL } from "@/lib/cluster";
import {
  localWalletForUid,
  readPublicCache,
  releaseLocalUid,
  writePublicCache,
  type CachedPublicProfile,
} from "@/lib/profile-cache";
import type { Profile } from "@/lib/profile";
import type { SlabSigner } from "@/lib/wallet";

const APP_NAME = "Slab";
const APP_FILE = "username";
const GQL_URLS = [
  `${IRYS_GATEWAY.replace(/\/$/, "")}/graphql`,
  "https://arweave.devnet.irys.xyz/graphql",
];

type GqlNode = {
  id: string;
  timestamp?: number;
  tags?: { name: string; value: string }[];
};

function tag(node: GqlNode, name: string): string {
  return (
    node.tags?.find((item) => item.name === name)?.value?.trim() ?? ""
  );
}

function isIrysUnpaid(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /402|not enough funds|not enough balance/i.test(msg);
}

async function graphql(uid: string): Promise<GqlNode[]> {
  const query = {
    query: `query {
      transactions(
        tags: [
          { name: "App-Name", values: ["${APP_NAME}"] }
          { name: "App-File", values: ["${APP_FILE}"] }
          { name: "Username", values: ["${uid}"] }
        ]
        first: 25
        order: DESC
      ) {
        edges { node { id timestamp tags { name value } } }
      }
    }`,
  };
  let lastErr: unknown;
  for (const url of GQL_URLS) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(query),
      });
      if (!res.ok) {
        lastErr = new Error(`GraphQL ${res.status}`);
        continue;
      }
      const body = (await res.json()) as {
        data?: {
          transactions?: { edges?: { node: GqlNode }[] };
        };
      };
      return body.data?.transactions?.edges?.map((edge) => edge.node) ?? [];
    } catch (err) {
      lastErr = err;
    }
  }
  if (lastErr) {
    throw lastErr instanceof Error ? lastErr : new Error("Username lookup failed");
  }
  return [];
}

function ownerWallet(nodes: GqlNode[]): string | null {
  if (nodes.length === 0) {
    return null;
  }
  const oldest = [...nodes].sort(
    (a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0)
  )[0];
  const wallet = tag(oldest, "Wallet");
  const latest = nodes.find((node) => tag(node, "Wallet") === wallet) ?? oldest;
  if (tag(latest, "Active") === "0") {
    return null;
  }
  return wallet || null;
}

async function readClaim(id: string): Promise<CachedPublicProfile | null> {
  try {
    const res = await fetch(`${IRYS_GATEWAY.replace(/\/$/, "")}/${id}`);
    if (!res.ok) {
      return null;
    }
    const row = (await res.json()) as CachedPublicProfile;
    if (!row?.uid || !row.name || !row.wallet) {
      return null;
    }
    return {
      uid: row.uid,
      name: row.name,
      bio: typeof row.bio === "string" ? row.bio : "",
      website: typeof row.website === "string" ? row.website : "",
      pfp: typeof row.pfp === "string" ? row.pfp : "",
      links: Array.isArray(row.links) ? row.links : ["", "", "", "", ""],
      wallet: row.wallet,
      readme: typeof row.readme === "string" ? row.readme : "",
    };
  } catch {
    return null;
  }
}

export async function lookupUsername(
  raw: string
): Promise<CachedPublicProfile | null> {
  const uid = raw.trim().toLowerCase();
  if (!/^[a-z][a-z0-9_]{2,31}$/.test(uid)) {
    return null;
  }
  const cached = readPublicCache(uid);
  try {
    const nodes = await graphql(uid);
    const wallet = ownerWallet(nodes);
    if (!wallet) {
      return cached?.wallet ? cached : null;
    }
    const latest = nodes.find((node) => tag(node, "Wallet") === wallet);
    const remote = latest ? await readClaim(latest.id) : null;
    const next =
      remote ??
      (cached?.wallet === wallet
        ? cached
        : {
            uid,
            name: uid,
            bio: "",
            website: "",
            pfp: "",
            links: ["", "", "", "", ""],
            wallet,
            readme: "",
          });
    writePublicCache(next);
    return next;
  } catch {
    if (cached) {
      return cached;
    }
    const wallet = localWalletForUid(uid);
    if (!wallet) {
      return null;
    }
    return {
      uid,
      name: uid,
      bio: "",
      website: "",
      pfp: "",
      links: ["", "", "", "", ""],
      wallet,
      readme: "",
    };
  }
}

export async function assertUsernameFree(
  uid: string,
  wallet: string
): Promise<void> {
  const local = localWalletForUid(uid);
  if (local && local !== wallet) {
    throw new Error("Username is taken");
  }
  const claim = await lookupUsername(uid);
  if (claim && claim.wallet !== wallet) {
    throw new Error("Username is taken");
  }
}

async function irysUpload(
  wallet: SlabSigner,
  data: Buffer,
  tags: { name: string; value: string }[]
): Promise<void> {
  const { WebUploader } = await import("@irys/web-upload");
  const { WebSolana } = await import("@irys/web-upload-solana");
  const irys = await WebUploader(WebSolana)
    .withProvider(wallet as never)
    .withRpc(IRYS_RPC_URL)
    .withTokenOptions({ finality: "confirmed" })
    .timeout(60_000)
    .devnet();
  const receipt = await irys.upload(data, { tags });
  if (!receipt?.id) {
    throw new Error("Username claim returned no id");
  }
}

async function uploadClaim(
  wallet: SlabSigner,
  tags: { name: string; value: string }[],
  body: unknown,
  onStatus: StatusFn
) {
  const data = Buffer.from(JSON.stringify(body));
  try {
    await irysUpload(wallet, data, tags);
  } catch (err) {
    if (!isIrysUnpaid(err)) {
      throw err;
    }
    onStatus("Funding Irys");
    await fundIrys(wallet, onStatus);
    await irysUpload(wallet, data, tags);
  }
}

export async function claimUsername(
  wallet: SlabSigner,
  profile: Profile,
  extras: { readme: string; previousUid?: string },
  onStatus: StatusFn = () => {}
): Promise<CachedPublicProfile> {
  const address = wallet.publicKey.toBase58();
  await assertUsernameFree(profile.uid, address);
  const row: CachedPublicProfile = {
    ...profile,
    wallet: address,
    readme: extras.readme,
  };
  onStatus("Claiming username");
  await uploadClaim(
    wallet,
    [
      { name: "Content-Type", value: "application/json" },
      { name: "App-Name", value: APP_NAME },
      { name: "App-File", value: APP_FILE },
      { name: "Username", value: profile.uid },
      { name: "Wallet", value: address },
      { name: "Active", value: "1" },
    ],
    row,
    onStatus
  );
  if (extras.previousUid && extras.previousUid !== profile.uid) {
    await uploadClaim(
      wallet,
      [
        { name: "Content-Type", value: "application/json" },
        { name: "App-Name", value: APP_NAME },
        { name: "App-File", value: APP_FILE },
        { name: "Username", value: extras.previousUid },
        { name: "Wallet", value: address },
        { name: "Active", value: "0" },
      ],
      { ...row, uid: extras.previousUid, active: false },
      onStatus
    );
    releaseLocalUid(extras.previousUid, address);
  }
  const again = await lookupUsername(profile.uid);
  if (again && again.wallet !== address) {
    throw new Error("Username is taken");
  }
  writePublicCache(row);
  return row;
}
