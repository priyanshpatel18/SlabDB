import { defaultApi } from "./auth";
import { IRYS_GATEWAY } from "slabdb";

const APP_NAME = "Slab";
const APP_FILE = "username";
const GQL_URLS = [
  `${IRYS_GATEWAY.replace(/\/$/, "")}/graphql`,
  "https://arweave.devnet.irys.xyz/graphql",
];

export type RemoteSpec = {
  uid: string;
  repo: string;
};

export type PublicClaim = {
  uid: string;
  wallet: string;
  readme: string;
};

type GqlNode = {
  id: string;
  timestamp?: number;
  tags?: { name: string; value: string }[];
};

function tag(node: GqlNode, name: string): string {
  return node.tags?.find((item) => item.name === name)?.value?.trim() ?? "";
}

export function parseRemote(raw: string): RemoteSpec {
  const value = raw.trim().replace(/^\/+/, "").toLowerCase();
  const [uid, repo] = value.split("/");
  if (!uid || !/^[a-z][a-z0-9_]{2,31}$/.test(uid)) {
    throw new Error("Clone target must be uid or uid/repo");
  }
  if (value.split("/").length > 2) {
    throw new Error("Clone target must be uid or uid/repo");
  }
  if (repo && (
    !/^[a-z][a-z0-9_-]{0,31}$/.test(repo) ||
    repo.endsWith("-") ||
    repo.includes("--")
  )) {
    throw new Error(
      "Repo name must start with a letter and use a-z, 0-9, -, and _"
    );
  }
  return { uid, repo: repo || "home" };
}

function assertUserRemote(spec: RemoteSpec): RemoteSpec {
  if (spec.repo === "home" || spec.repo === "profile" || spec.repo === "users") {
    throw new Error("Remote must be a user repository");
  }
  return spec;
}

export type RemoteUrl = {
  api: string;
  uid: string;
  repo: string;
  url: string;
};

export function parseRemoteUrl(raw: string): RemoteUrl {
  const value = raw.trim();
  if (!value) {
    throw new Error("Remote URL is required");
  }
  let parsed: URL | null = null;
  try {
    parsed = new URL(value);
  } catch {
    parsed = null;
  }
  if (!parsed) {
    const spec = assertUserRemote(parseRemote(value));
    if (!value.includes("/")) {
      throw new Error("Remote must be uid/repo or a full Slab URL");
    }
    const api = defaultApi();
    return {
      api,
      uid: spec.uid,
      repo: spec.repo,
      url: `${api}/${spec.uid}/${spec.repo}`,
    };
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Remote URL must be http or https");
  }
  const parts = parsed.pathname.replace(/^\/+|\/+$/g, "").split("/");
  if (parts.length !== 2) {
    throw new Error("Remote URL must be https://host/{uid}/{repo}");
  }
  const spec = assertUserRemote(parseRemote(`${parts[0]}/${parts[1]}`));
  const api = `${parsed.protocol}//${parsed.host}`;
  return {
    api,
    uid: spec.uid,
    repo: spec.repo,
    url: `${api}/${spec.uid}/${spec.repo}`,
  };
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
        signal: AbortSignal.timeout(8_000),
      });
      if (!res.ok) {
        lastErr = new Error(`GraphQL ${res.status}`);
        continue;
      }
      const body = (await res.json()) as {
        data?: { transactions?: { edges?: { node: GqlNode }[] } };
      };
      return body.data?.transactions?.edges?.map((edge) => edge.node) ?? [];
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("Username lookup failed");
}

export async function lookupClaim(uid: string): Promise<PublicClaim> {
  const nodes = await graphql(uid);
  if (nodes.length === 0) {
    throw new Error(`No Slab user named ${uid}`);
  }
  const oldest = [...nodes].sort(
    (a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0)
  )[0];
  const wallet = tag(oldest, "Wallet");
  const latest = nodes.find((node) => tag(node, "Wallet") === wallet) ?? oldest;
  if (!wallet || tag(latest, "Active") === "0") {
    throw new Error(`No Slab user named ${uid}`);
  }
  let readme = "";
  try {
    const res = await fetch(`${IRYS_GATEWAY.replace(/\/$/, "")}/${latest.id}`, {
      signal: AbortSignal.timeout(8_000),
    });
    if (res.ok) {
      const row = (await res.json()) as { readme?: string };
      readme = typeof row.readme === "string" ? row.readme : "";
    }
  } catch {
    readme = "";
  }
  return { uid, wallet, readme };
}
