import { PublicKey } from "@solana/web3.js";
import { TEXT_MAX_BYTES, type SlabClient } from "slabdb";
import { Slab } from "slabdb/node";
import {
  commitBlobPath,
  commitMetaPath,
  isHistoryPath,
  makeCommitId,
  parseCommitMeta,
  parseMetaPath,
  type CommitFile,
  type CommitRecord,
} from "./history";
import {
  FILES_SQL,
  HOME_NS,
  sqlTable,
  type SlabConfig,
  type StagedFile,
} from "./repo";
import type { CliWallet } from "./wallet";

function log(msg: string) {
  process.stderr.write(`${msg}\n`);
}

export async function openDb(
  wallet: CliWallet,
  config: Pick<SlabConfig, "ns" | "owner">,
  opts: { autoDelegate?: boolean } = {}
): Promise<SlabClient> {
  const owner = config.owner ? new PublicKey(config.owner) : wallet.publicKey;
  log("Opening Slab");
  return Slab.connect({
    wallet,
    ns: config.ns || HOME_NS,
    owner,
    autoDelegate: opts.autoDelegate,
  });
}

export async function listFiles(
  client: SlabClient,
  repo: string
): Promise<StagedFile[]> {
  const table = sqlTable(repo);
  const rows = await client.exec(`SELECT * FROM ${table}`);
  return rows
    .map((row) => ({
      path: typeof row.path === "string" ? row.path : "",
      body: typeof row.body === "string" ? row.body : "",
    }))
    .filter((row) => row.path && !isHistoryPath(row.path));
}

export async function ensureRepo(client: SlabClient, repo: string) {
  const rels = (await client.db.catalog()).rels;
  if (rels.some((rel) => rel.name === repo)) {
    return;
  }
  log(`CREATE TABLE ${repo}`);
  await client.exec(`CREATE TABLE ${sqlTable(repo)} ${FILES_SQL}`);
}

async function latestCommitId(client: SlabClient, repo: string): Promise<string | null> {
  const table = sqlTable(repo);
  const rows = await client.exec(`SELECT * FROM ${table}`);
  const metas: CommitRecord[] = [];
  for (const row of rows) {
    const path = typeof row.path === "string" ? row.path : "";
    const id = parseMetaPath(path);
    if (!id) {
      continue;
    }
    const meta = parseCommitMeta(typeof row.body === "string" ? row.body : "");
    if (meta) {
      metas.push(meta);
    }
  }
  metas.sort((a, b) => b.created_at.localeCompare(a.created_at));
  return metas[0]?.id ?? null;
}

async function recordCommit(
  client: SlabClient,
  repo: string,
  files: CommitFile[],
  message: string,
  author: string
) {
  if (files.length === 0) {
    return;
  }
  const parent = await latestCommitId(client, repo);
  const created_at = new Date().toISOString();
  const id = makeCommitId(
    `${repo}:${parent}:${created_at}:${message}:${files
      .map((file) => `${file.action}:${file.path}`)
      .join("|")}`
  );
  const meta: CommitRecord = {
    id,
    parent,
    message,
    created_at,
    author,
    files: files.map((file) => ({ path: file.path, action: file.action })),
  };
  const table = sqlTable(repo);
  await client.exec(`INSERT INTO ${table} (path, body) VALUES ($1, $2)`, [
    commitMetaPath(id),
    JSON.stringify(meta),
  ]);
  for (const file of files) {
    if (file.action === "delete" || file.body == null) {
      continue;
    }
    await client.exec(`INSERT INTO ${table} (path, body) VALUES ($1, $2)`, [
      commitBlobPath(id, file.path),
      file.body,
    ]);
  }
}

export async function upsertFiles(
  client: SlabClient,
  repo: string,
  files: StagedFile[],
  opts: { message?: string; author?: string } = {}
) {
  const remote = new Map(
    (await listFiles(client, repo)).map((file) => [file.path, file.body])
  );
  const changed: CommitFile[] = [];
  for (const file of files) {
    if (isHistoryPath(file.path)) {
      continue;
    }
    const bytes = Buffer.byteLength(file.body, "utf8");
    if (bytes > TEXT_MAX_BYTES) {
      throw new Error(`${file.path} is ${bytes} bytes. Max is ${TEXT_MAX_BYTES}`);
    }
    const prev = remote.get(file.path);
    if (prev === file.body) {
      continue;
    }
    log(`Writing ${file.path}`);
    const table = sqlTable(repo);
    if (prev != null) {
      await client.exec(`UPDATE ${table} SET body = $1 WHERE path = $2`, [
        file.body,
        file.path,
      ]);
      changed.push({ path: file.path, action: "update", body: file.body });
    } else {
      await client.exec(`INSERT INTO ${table} (path, body) VALUES ($1, $2)`, [
        file.path,
        file.body,
      ]);
      changed.push({ path: file.path, action: "add", body: file.body });
    }
  }
  if (changed.length === 0) {
    log("No file changes");
    return 0;
  }
  await recordCommit(
    client,
    repo,
    changed,
    opts.message?.trim() || `Update ${changed.length} files`,
    opts.author?.trim() || ""
  );
  return changed.length;
}
