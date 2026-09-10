import { unstable_cache } from "next/cache";
import {
  Keypair,
  PublicKey,
  Transaction,
  VersionedTransaction,
} from "@solana/web3.js";
import { HOME_NS } from "@/lib/cluster";
import {
  ABOUT_PATH,
  isHiddenPath,
  parseAboutBody,
  sqlTable,
} from "@/lib/files";
import { parseMetaPath } from "@/lib/history";
import { lookupUsernameRemote } from "@/lib/username-lookup";

export type RepoShare = {
  uid: string;
  repo: string;
  name: string;
  pfp: string;
  description: string;
  commits: number;
  files: number;
  statsLoaded: boolean;
};

type CatalogShare = {
  description: string;
  commits: number;
  files: number;
};

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${Math.round(ms / 1000)}s`));
    }, ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

function clipText(text: string, max: number): string {
  const value = text.trim().replace(/\s+/g, " ");
  if (value.length <= max) {
    return value;
  }
  return `${value.slice(0, max - 3).trimEnd()}...`;
}

function guestWallet() {
  const kp = Keypair.generate();
  const deny = async <T extends Transaction | VersionedTransaction>(
    tx: T
  ): Promise<T> => {
    void tx;
    throw new Error("Read only");
  };
  return {
    publicKey: kp.publicKey,
    signTransaction: deny,
    signAllTransactions: async <T extends Transaction | VersionedTransaction>(
      txs: T[]
    ): Promise<T[]> => {
      void txs;
      throw new Error("Read only");
    },
  };
}

function parseCatalogRows(rows: { path?: unknown; body?: unknown }[]): CatalogShare {
  let description = "";
  let commits = 0;
  let files = 0;
  for (const row of rows) {
    const path = typeof row.path === "string" ? row.path : "";
    const body = typeof row.body === "string" ? row.body : "";
    if (!path) {
      continue;
    }
    if (path === ABOUT_PATH) {
      description = parseAboutBody(body).description;
      continue;
    }
    if (parseMetaPath(path)) {
      commits += 1;
      continue;
    }
    if (isHiddenPath(path)) {
      continue;
    }
    files += 1;
  }
  return { description, commits, files };
}

async function readCatalogShare(
  owner: string,
  repo: string
): Promise<CatalogShare | null> {
  try {
    return await withTimeout(
      (async () => {
        const { Slab } = await import("slabdb/node");
        const client = await Slab.connect({
          wallet: guestWallet(),
          ns: HOME_NS,
          owner: new PublicKey(owner),
          autoDelegate: false,
        });
        const rels = (await client.db.catalog()).rels;
        if (!rels.some((rel) => rel.name === repo)) {
          return { description: "", commits: 0, files: 0 };
        }
        const rows = await client.exec(`SELECT * FROM ${sqlTable(repo)}`);
        return parseCatalogRows(rows);
      })(),
      8_000,
      "Repo share"
    );
  } catch {
    return null;
  }
}

async function loadRepoShareInner(
  uid: string,
  repo: string
): Promise<RepoShare | null> {
  const profile = await lookupUsernameRemote(uid);
  if (!profile) {
    return null;
  }
  const catalog = await readCatalogShare(profile.wallet, repo);
  return {
    uid: profile.uid,
    repo,
    name: profile.name || profile.uid,
    pfp: profile.pfp,
    description: catalog?.description ?? "",
    commits: catalog?.commits ?? 0,
    files: catalog?.files ?? 0,
    statsLoaded: catalog !== null,
  };
}

export const loadRepoShare = unstable_cache(
  loadRepoShareInner,
  ["slab-repo-share"],
  { revalidate: 60 }
);

export function repoShareSeo(share: RepoShare | null, uid: string, repo: string) {
  const slug = `${uid}/${repo}`;
  if (share?.description) {
    return {
      title: `Slab - ${slug}: ${clipText(share.description, 80)}`,
      description: `${share.description} - ${slug}`,
    };
  }
  return {
    title: slug,
    description: `${slug} on Slab.`,
  };
}
