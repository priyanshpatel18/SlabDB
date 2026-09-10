import { PublicKey } from "@solana/web3.js";
import { type SlabClient } from "slabdb";
import { Slab } from "slabdb/node";
import { HOME_NS } from "@/lib/cluster";
import { sqlTable } from "@/lib/files";
import { commitBlobPath, commitMetaPath, isHistoryPath } from "@/lib/history";
import {
  type CliPushCommit,
  type CliPushFile,
} from "@/lib/cli-push";
import { privySlabWallet } from "@/lib/privy-slab-wallet";
import { ServerIrysStore } from "@/lib/server-irys-store";

export { parseCliPush, CLI_PUSH_MAX_FILES } from "@/lib/cli-push";
export type { CliPushCommit, CliPushFile } from "@/lib/cli-push";

const FILES_SQL = `(path text PRIMARY KEY, body text NOT NULL)`;

async function ensureRepo(client: SlabClient, repo: string) {
  const rels = (await client.db.catalog()).rels;
  if (rels.some((rel) => rel.name === repo)) {
    return;
  }
  await client.exec(`CREATE TABLE ${sqlTable(repo)} ${FILES_SQL}`);
}

async function applyFiles(
  client: SlabClient,
  repo: string,
  files: CliPushFile[]
): Promise<{ path: string; action: "add" | "update" }[]> {
  const table = sqlTable(repo);
  const rows = await client.exec(`SELECT * FROM ${table}`);
  const remote = new Map<string, string>();
  for (const row of rows) {
    const path = typeof row.path === "string" ? row.path : "";
    const body = typeof row.body === "string" ? row.body : "";
    if (!path || isHistoryPath(path)) {
      continue;
    }
    remote.set(path, body);
  }
  const changed: { path: string; action: "add" | "update" }[] = [];
  for (const file of files) {
    const prev = remote.get(file.path);
    if (prev === file.body) {
      continue;
    }
    if (prev != null) {
      await client.exec(`UPDATE ${table} SET body = $1 WHERE path = $2`, [
        file.body,
        file.path,
      ]);
      changed.push({ path: file.path, action: "update" });
    } else {
      await client.exec(`INSERT INTO ${table} (path, body) VALUES ($1, $2)`, [
        file.path,
        file.body,
      ]);
      changed.push({ path: file.path, action: "add" });
    }
  }
  return changed;
}

async function recordCommit(
  client: SlabClient,
  repo: string,
  commit: CliPushCommit,
  changed: { path: string; action: "add" | "update" }[]
) {
  const table = sqlTable(repo);
  const existing = await client.exec(
    `SELECT * FROM ${table} WHERE path = $1`,
    [commitMetaPath(commit.id)]
  );
  if (existing.length > 0) {
    return;
  }
  const meta = {
    id: commit.id,
    parent: commit.parent,
    message: commit.message,
    created_at: commit.created_at,
    author: commit.author,
    files: changed.map((file) => ({ path: file.path, action: file.action })),
  };
  await client.exec(`INSERT INTO ${table} (path, body) VALUES ($1, $2)`, [
    commitMetaPath(commit.id),
    JSON.stringify(meta),
  ]);
  const bodies = new Map(commit.files.map((file) => [file.path, file.body]));
  for (const file of changed) {
    const body = bodies.get(file.path);
    if (body == null) {
      continue;
    }
    await client.exec(`INSERT INTO ${table} (path, body) VALUES ($1, $2)`, [
      commitBlobPath(commit.id, file.path),
      body,
    ]);
  }
}

export async function applyCliPush(opts: {
  walletId: string;
  wallet: string;
  repo: string;
  commit: CliPushCommit;
}): Promise<{ wrote: number; id: string; urlPath: string }> {
  const client = await Slab.connect({
    wallet: privySlabWallet(opts.walletId, opts.wallet),
    ns: HOME_NS,
    owner: new PublicKey(opts.wallet),
    autoDelegate: true,
    store: new ServerIrysStore(),
  });
  await ensureRepo(client, opts.repo);
  const rows = await client.exec(
    `SELECT * FROM ${sqlTable(opts.repo)} WHERE path = $1`,
    [commitMetaPath(opts.commit.id)]
  );
  if (rows.length > 0) {
    return { wrote: 0, id: opts.commit.id, urlPath: "" };
  }
  const changed = await applyFiles(client, opts.repo, opts.commit.files);
  if (changed.length === 0) {
    await recordCommit(client, opts.repo, opts.commit, []);
    return { wrote: 0, id: opts.commit.id, urlPath: "" };
  }
  await recordCommit(client, opts.repo, opts.commit, changed);
  return {
    wrote: changed.length,
    id: opts.commit.id,
    urlPath: "",
  };
}
