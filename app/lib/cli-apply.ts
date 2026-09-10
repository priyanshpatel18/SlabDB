import { PublicKey } from "@solana/web3.js";
import { TEXT_MAX_BYTES, type SlabClient } from "slabdb";
import { Slab } from "slabdb/node";
import { HOME_NS, HOME_REPO } from "@/lib/cluster";
import {
  ABOUT_PATH,
  assertFilePath,
  isRepoName,
  isUserRepo,
  parseRepoParam,
  sqlTable,
  utf8Bytes,
} from "@/lib/files";
import {
  COMMIT_MESSAGE_MAX,
  commitBlobPath,
  commitMetaPath,
  isHistoryPath,
  normalizeCommitMessage,
} from "@/lib/history";
import { privySlabWallet } from "@/lib/privy-slab-wallet";
import { ServerIrysStore } from "@/lib/server-irys-store";

export const CLI_PUSH_MAX_FILES = 40;

export type CliPushFile = {
  path: string;
  body: string;
};

export type CliPushCommit = {
  id: string;
  parent: string | null;
  message: string;
  created_at: string;
  author: string;
  files: CliPushFile[];
};

const FILES_SQL = `(path text PRIMARY KEY, body text NOT NULL)`;
const COMMIT_ID_RE = /^[a-f0-9]{8}$/;

function assertPushPath(raw: string): string {
  const path = raw.trim();
  if (path === ABOUT_PATH) {
    return path;
  }
  return assertFilePath(path);
}

export function parseCliPush(body: unknown): {
  uid: string;
  repo: string;
  commit: CliPushCommit;
} {
  const row = body as {
    uid?: unknown;
    repo?: unknown;
    commit?: {
      id?: unknown;
      parent?: unknown;
      message?: unknown;
      created_at?: unknown;
      author?: unknown;
      files?: unknown;
    };
  };
  const uid = typeof row?.uid === "string" ? row.uid.trim().toLowerCase() : "";
  const repo = parseRepoParam(typeof row?.repo === "string" ? row.repo : "");
  const commit = row?.commit;
  if (!uid || !repo || !commit) {
    throw Object.assign(new Error("uid, repo, and commit are required"), {
      status: 400,
    });
  }
  if (!isRepoName(repo) || !isUserRepo(repo) || repo === HOME_REPO) {
    throw Object.assign(new Error("Invalid repository name"), { status: 400 });
  }
  const id = typeof commit.id === "string" ? commit.id.trim().toLowerCase() : "";
  if (!COMMIT_ID_RE.test(id)) {
    throw Object.assign(new Error("Commit id must be 8 hex characters"), {
      status: 400,
    });
  }
  const parent =
    commit.parent === null || commit.parent === undefined
      ? null
      : typeof commit.parent === "string"
        ? commit.parent.trim().toLowerCase()
        : "";
  if (parent !== null && !COMMIT_ID_RE.test(parent)) {
    throw Object.assign(new Error("Commit parent must be 8 hex characters"), {
      status: 400,
    });
  }
  let message = "";
  try {
    message = normalizeCommitMessage(
      typeof commit.message === "string" ? commit.message : ""
    );
  } catch (err) {
    throw Object.assign(
      new Error(err instanceof Error ? err.message : "Commit message is required"),
      { status: 400 }
    );
  }
  if (message.length > COMMIT_MESSAGE_MAX) {
    throw Object.assign(new Error("Commit message is too long"), { status: 400 });
  }
  const created_at =
    typeof commit.created_at === "string" ? commit.created_at.trim() : "";
  if (!created_at || Number.isNaN(Date.parse(created_at))) {
    throw Object.assign(new Error("Commit created_at must be an ISO date"), {
      status: 400,
    });
  }
  const author =
    typeof commit.author === "string" ? commit.author.trim().toLowerCase() : uid;
  const rawFiles = Array.isArray(commit.files) ? commit.files : [];
  if (rawFiles.length === 0) {
    throw Object.assign(new Error("Commit has no files"), { status: 400 });
  }
  if (rawFiles.length > CLI_PUSH_MAX_FILES) {
    throw Object.assign(
      new Error(`Commit can have at most ${CLI_PUSH_MAX_FILES} files`),
      { status: 400 }
    );
  }
  const files: CliPushFile[] = rawFiles.map((file) => {
    const item = file as { path?: unknown; body?: unknown };
    const path = assertPushPath(typeof item.path === "string" ? item.path : "");
    if (isHistoryPath(path)) {
      throw Object.assign(new Error("Do not push .history files"), {
        status: 400,
      });
    }
    const fileBody = typeof item.body === "string" ? item.body : "";
    if (utf8Bytes(fileBody) > TEXT_MAX_BYTES) {
      throw Object.assign(
        new Error(`${path} is longer than ${TEXT_MAX_BYTES} bytes`),
        { status: 400 }
      );
    }
    return { path, body: fileBody };
  });
  return {
    uid,
    repo,
    commit: { id, parent, message, created_at, author, files },
  };
}

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
