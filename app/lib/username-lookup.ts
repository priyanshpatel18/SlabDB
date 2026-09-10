import { IRYS_GATEWAY, isReservedUsername } from "@/lib/cluster";

export const USERNAME_APP = "Slab";
export const USERNAME_FILE = "username";

const GQL_URLS = [
  `${IRYS_GATEWAY.replace(/\/$/, "")}/graphql`,
  "https://arweave.devnet.irys.xyz/graphql",
];

const USERNAME_RE = /^[a-z][a-z0-9_]{2,31}$/;

export type PublicProfile = {
  uid: string;
  name: string;
  bio: string;
  website: string;
  pfp: string;
  links: string[];
  wallet: string;
  readme: string;
};

type GqlNode = {
  id: string;
  timestamp?: number;
  tags?: { name: string; value: string }[];
};

export function isUsernameFormat(raw: string): boolean {
  return USERNAME_RE.test(raw.trim().toLowerCase());
}

export function normalizeUsername(raw: string): string {
  return decodeURIComponent(raw).trim().toLowerCase();
}

function tag(node: GqlNode, name: string): string {
  return node.tags?.find((item) => item.name === name)?.value?.trim() ?? "";
}

async function graphqlTags(
  extra: { name: string; values: string[] }[]
): Promise<GqlNode[]> {
  const tags = [
    { name: "App-Name", values: [USERNAME_APP] },
    { name: "App-File", values: [USERNAME_FILE] },
    ...extra,
  ]
    .map(
      (item) =>
        `{ name: ${JSON.stringify(item.name)}, values: ${JSON.stringify(item.values)} }`
    )
    .join("\n          ");
  const query = {
    query: `query {
      transactions(
        tags: [
          ${tags}
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
        signal: AbortSignal.timeout(8_000),
        next: { revalidate: 60 },
      } as RequestInit);
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

function parseClaim(row: PublicProfile): PublicProfile | null {
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
}

async function readClaim(id: string): Promise<PublicProfile | null> {
  try {
    const res = await fetch(`${IRYS_GATEWAY.replace(/\/$/, "")}/${id}`, {
      signal: AbortSignal.timeout(8_000),
      next: { revalidate: 60 },
    } as RequestInit);
    if (!res.ok) {
      return null;
    }
    return parseClaim((await res.json()) as PublicProfile);
  } catch {
    return null;
  }
}

function stubProfile(uid: string, wallet: string): PublicProfile {
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

export async function lookupUsernameRemote(
  raw: string
): Promise<PublicProfile | null> {
  const uid = normalizeUsername(raw);
  if (!isUsernameFormat(uid) || isReservedUsername(uid)) {
    return null;
  }
  const nodes = await graphqlTags([{ name: "Username", values: [uid] }]);
  const wallet = ownerWallet(nodes);
  if (!wallet) {
    return null;
  }
  const latest = nodes.find((node) => tag(node, "Wallet") === wallet);
  const remote = latest ? await readClaim(latest.id) : null;
  return remote ?? stubProfile(uid, wallet);
}

export async function lookupWalletRemote(
  address: string
): Promise<PublicProfile | null> {
  const wallet = address.trim();
  if (!wallet) {
    return null;
  }
  const nodes = await graphqlTags([{ name: "Wallet", values: [wallet] }]);
  const active = nodes.filter((node) => tag(node, "Active") !== "0");
  const latest = [...active].sort(
    (a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0)
  )[0];
  if (!latest) {
    return null;
  }
  const uid = tag(latest, "Username");
  if (!isUsernameFormat(uid) || isReservedUsername(uid)) {
    return null;
  }
  const remote = await readClaim(latest.id);
  return remote ?? stubProfile(uid, wallet);
}
