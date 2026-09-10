"use client";

import { Buffer } from "buffer";
import { PublicKey } from "@solana/web3.js";
import { isAlreadyPrepared, TEXT_MAX_BYTES, withTimeout, type RelInfo } from "slabdb";
import { Slab, BrowserIrysPageStore, type StatusFn } from "slabdb/web";
import { HOME_NS, HOME_REPO, README_PATH } from "@/lib/cluster";
import {
  ABOUT_PATH,
  assertFilePath,
  isRepoName,
  isUserRepo,
  normalizeDescription,
  normalizeWebsite,
  parseAboutBody,
  serializeAboutBody,
  sqlTable,
  utf8Bytes,
  type RepoFileRow,
} from "@/lib/files";
import {
  commitBlobPath,
  commitMetaPath,
  isHistoryPath,
  makeCommitId,
  normalizeCommitMessage,
  parseBlobPath,
  parseCommitMeta,
  parseMetaPath,
  type CommitFile,
  type CommitRecord,
} from "@/lib/history";
import type { SlabSigner } from "@/lib/wallet";
import type { ChainSession } from "@/lib/session";

if (typeof globalThis.Buffer === "undefined") {
  (globalThis as unknown as { Buffer: typeof Buffer }).Buffer = Buffer;
}

export type HomeState = {
  session: ChainSession;
  repos: RelInfo[];
  active: string;
  readme: string;
};

const FILES_SQL = `(path text PRIMARY KEY, body text NOT NULL)`;

export function assertRepoName(raw: string): string {
  const name = raw.trim().toLowerCase();
  if (!isRepoName(name)) {
    throw new Error(
      "Repo name must start with a letter and use a-z, 0-9, -, and _"
    );
  }
  if (name === HOME_REPO || name === "profile" || name === "users") {
    throw new Error(`${name} is reserved`);
  }
  return name;
}

function tableName(repo: string): string {
  return repo === HOME_REPO ? HOME_REPO : assertRepoName(repo);
}

export type RepoState = {
  files: RepoFileRow[];
  commits: CommitRecord[];
  description: string;
  website: string;
};

function asFileRows(
  rows: { path?: unknown; body?: unknown }[]
): RepoFileRow[] {
  return rows
    .map((row) => ({
      path: typeof row.path === "string" ? row.path : "",
      body: typeof row.body === "string" ? row.body : "",
    }))
    .filter((row) => row.path);
}

function splitRepoRows(rows: RepoFileRow[]): RepoState {
  const files: RepoFileRow[] = [];
  const metas: CommitRecord[] = [];
  const blobs = new Map<string, string>();
  let description = "";
  let website = "";
  for (const row of rows) {
    if (row.path === ABOUT_PATH) {
      const about = parseAboutBody(row.body);
      description = about.description;
      website = about.website;
      continue;
    }
    const metaId = parseMetaPath(row.path);
    if (metaId) {
      const meta = parseCommitMeta(row.body);
      if (meta) {
        metas.push(meta);
      }
      continue;
    }
    const blob = parseBlobPath(row.path);
    if (blob) {
      blobs.set(`${blob.id}:${blob.path}`, row.body);
      continue;
    }
    if (!isHistoryPath(row.path)) {
      files.push(row);
    }
  }
  for (const commit of metas) {
    for (const file of commit.files) {
      if (file.action !== "delete") {
        file.body = blobs.get(`${commit.id}:${file.path}`);
      }
    }
  }
  metas.sort(
    (a, b) =>
      b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id)
  );
  files.sort((a, b) => a.path.localeCompare(b.path));
  return { files, commits: metas, description, website };
}

async function recordCommit(
  db: ChainSession["db"],
  repo: string,
  files: CommitFile[],
  message: string,
  author: string
): Promise<void> {
  if (repo === HOME_REPO || files.length === 0) {
    return;
  }
  const state = splitRepoRows(asFileRows(await db.exec(`SELECT * FROM ${sqlTable(repo)}`)));
  const parent = state.commits[0]?.id ?? null;
  const created_at = new Date().toISOString();
  const text = normalizeCommitMessage(message);
  const id = await makeCommitId(
    `${repo}:${parent}:${created_at}:${text}:${files
      .map((file) => `${file.action}:${file.path}`)
      .join("|")}:${Math.random()}`
  );
  const meta: CommitRecord = {
    id,
    parent,
    message: text,
    created_at,
    author,
    files: files.map((file) => ({ path: file.path, action: file.action })),
  };
  await db.exec(`INSERT INTO ${sqlTable(repo)} (path, body) VALUES ($1, $2)`, [
    commitMetaPath(id),
    JSON.stringify(meta),
  ]);
  for (const file of files) {
    if (file.action === "delete" || file.body == null) {
      continue;
    }
    await db.exec(`INSERT INTO ${sqlTable(repo)} (path, body) VALUES ($1, $2)`, [
      commitBlobPath(id, file.path),
      file.body,
    ]);
  }
}

export function defaultReadme(repo: string, address?: string): string {
  if (repo === HOME_REPO && address) {
    return [`# ${repo}`, "", `\`${address}\``, ""].join("\n");
  }
  return `# ${repo}\n`;
}

function isPitchReadme(body: string): boolean {
  return /default file is `README\.md`|open the SQL console|MagicBlock public rollup|This is the public homepage/i.test(
    body
  );
}

async function snapshot(
  db: ChainSession["db"],
  erUrl: string
): Promise<ChainSession> {
  let rels: RelInfo[] = [];
  try {
    rels = (await db.catalog()).rels;
  } catch {
    rels = [];
  }
  return {
    db,
    delegated: await db.isDelegated(),
    rels,
    erUrl,
    slab: db.slabPda.toBase58(),
  };
}

async function readmeBody(
  db: ChainSession["db"],
  repo: string
): Promise<string> {
  const rows = await db.exec(`SELECT * FROM ${sqlTable(repo)} WHERE path = $1`, [
    README_PATH,
  ]);
  const body = rows[0]?.body;
  return typeof body === "string" ? body : "";
}

const inflight = new Map<string, Promise<HomeState>>();

function isAlreadyThere(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /already exists|already present|duplicate|unique/i.test(msg);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function ensureReadme(
  db: ChainSession["db"],
  repo: string,
  address: string,
  onStatus: StatusFn
): Promise<string> {
  const next = defaultReadme(repo, address);
  const existing = await readmeBody(db, repo);
  if (existing && !isPitchReadme(existing)) {
    return existing;
  }
  onStatus(`Writing ${README_PATH}`);
  if (existing && isPitchReadme(existing)) {
    await db.exec(`UPDATE ${sqlTable(repo)} SET body = $1 WHERE path = $2`, [
      next,
      README_PATH,
    ]);
    return next;
  }
  try {
    await db.exec(`INSERT INTO ${sqlTable(repo)} (path, body) VALUES ($1, $2)`, [
      README_PATH,
      next,
    ]);
  } catch (err) {
    if (!isAlreadyThere(err) && !isAlreadyPrepared(err)) {
      throw err;
    }
    await sleep(800);
    const again = await readmeBody(db, repo);
    if (again && !isPitchReadme(again)) {
      return again;
    }
    if (isAlreadyThere(err)) {
      return next;
    }
    throw err;
  }
  return (await readmeBody(db, repo)) || next;
}

async function openHomeInner(
  wallet: SlabSigner,
  onStatus: StatusFn
): Promise<HomeState> {
  if (!wallet.publicKey) {
    throw new Error("Sign in first");
  }
  const address = wallet.publicKey.toBase58();
  return withTimeout(
    (async () => {
      onStatus("Opening home");
      const client = await Slab.connect({
        wallet,
        ns: HOME_NS,
      });
      const store = client.db.store as BrowserIrysPageStore;
      if ("onStatus" in store) {
        store.onStatus = onStatus;
      }
      try {
        let session = await snapshot(client.db, client.erUrl);
        const db = session.db;
        const home = session.rels.find((rel) => rel.name === HOME_REPO);
        if (!home) {
          onStatus("CREATE TABLE home");
          try {
            await db.exec(`CREATE TABLE ${HOME_REPO} ${FILES_SQL}`);
          } catch (err) {
            if (!isAlreadyThere(err) && !isAlreadyPrepared(err)) {
              throw err;
            }
          }
          session = await snapshot(db, session.erUrl);
        }
        const readme = await ensureReadme(db, HOME_REPO, address, onStatus);
        session = await snapshot(db, session.erUrl);
        onStatus("");
        return {
          session,
          repos: session.rels,
          active: HOME_REPO,
          readme,
        };
      } finally {
        if ("onStatus" in store) {
          store.onStatus = () => {};
        }
      }
    })(),
    90_000,
    "Home"
  );
}

export async function openHome(
  wallet: SlabSigner,
  onStatus: StatusFn = () => {}
): Promise<HomeState> {
  if (!wallet.publicKey) {
    throw new Error("Sign in first");
  }
  const key = wallet.publicKey.toBase58();
  const pending = inflight.get(key);
  if (pending) {
    return pending;
  }
  const next = openHomeInner(wallet, onStatus).finally(() => {
    inflight.delete(key);
  });
  inflight.set(key, next);
  return next;
}

export async function saveReadme(
  session: ChainSession,
  repo: string,
  body: string,
  onStatus: StatusFn = () => {}
): Promise<string> {
  const name = repo === HOME_REPO ? HOME_REPO : assertRepoName(repo);
  return withTimeout(
    (async () => {
      onStatus(`Writing ${README_PATH}`);
      const rows = await session.db.exec(
        `SELECT * FROM ${sqlTable(name)} WHERE path = $1`,
        [README_PATH]
      );
      if (rows[0]) {
        await session.db.exec(
          `UPDATE ${sqlTable(name)} SET body = $1 WHERE path = $2`,
          [body, README_PATH]
        );
      } else {
        await session.db.exec(
          `INSERT INTO ${sqlTable(name)} (path, body) VALUES ($1, $2)`,
          [README_PATH, body]
        );
      }
      onStatus("");
      return (await readmeBody(session.db, name)) || body;
    })(),
    90_000,
    "README"
  );
}

export async function loadRepoReadme(
  session: ChainSession,
  repo: string
): Promise<string> {
  const name = repo === HOME_REPO ? HOME_REPO : assertRepoName(repo);
  return withTimeout(readmeBody(session.db, name), 30_000, "README");
}

export async function createRepo(
  session: ChainSession,
  rawName: string,
  address: string,
  onStatus: StatusFn = () => {},
  opts: { description?: string; addReadme?: boolean; author?: string } = {}
): Promise<HomeState> {
  const name = assertRepoName(rawName);
  return withTimeout(
    (async () => {
      onStatus(`CREATE TABLE ${name}`);
      await session.db.exec(`CREATE TABLE ${sqlTable(name)} ${FILES_SQL}`);
      if (opts.addReadme !== false) {
        onStatus(`Writing ${README_PATH}`);
        const body = defaultReadme(name);
        await session.db.exec(
          `INSERT INTO ${sqlTable(name)} (path, body) VALUES ($1, $2)`,
          [README_PATH, body]
        );
        await recordCommit(
          session.db,
          name,
          [{ path: README_PATH, action: "add", body }],
          name,
          opts.author?.trim() || address
        );
      }
      const about = normalizeDescription(opts.description ?? "");
      if (about) {
        onStatus("Saving description");
        await session.db.exec(
          `INSERT INTO ${sqlTable(name)} (path, body) VALUES ($1, $2)`,
          [ABOUT_PATH, about]
        );
      }
      const next = await snapshot(session.db, session.erUrl);
      const readme = await readmeBody(next.db, name);
      onStatus("");
      return {
        session: next,
        repos: next.rels,
        active: name,
        readme,
      };
    })(),
    90_000,
    "New repo"
  );
}

const catalogHold = new Map<string, Promise<ChainSession>>();

export async function openCatalog(
  wallet: SlabSigner,
  owner: string,
  onStatus: StatusFn = () => {}
): Promise<ChainSession> {
  if (!wallet.publicKey) {
    throw new Error("Sign in first");
  }
  const ownerKey = new PublicKey(owner);
  const key = `${wallet.publicKey.toBase58()}:${owner}`;
  const pending = catalogHold.get(key);
  if (pending) {
    return pending;
  }
  const next = withTimeout(
    (async () => {
      onStatus("Opening catalog");
      const client = await Slab.connect({
        wallet,
        ns: HOME_NS,
        owner: ownerKey,
        autoDelegate: false,
      });
      const store = client.db.store as BrowserIrysPageStore;
      if ("onStatus" in store) {
        store.onStatus = onStatus;
      }
      try {
        const session = await snapshot(client.db, client.erUrl);
        onStatus("");
        return session;
      } finally {
        if ("onStatus" in store) {
          store.onStatus = () => {};
        }
      }
    })(),
    90_000,
    "Catalog"
  ).finally(() => {
    catalogHold.delete(key);
  });
  catalogHold.set(key, next);
  return next;
}

export function userRepos(rels: RelInfo[]): RelInfo[] {
  return rels.filter((rel) => isUserRepo(rel.name));
}

export async function listRepoState(
  session: ChainSession,
  repo: string
): Promise<RepoState> {
  const name = tableName(repo);
  return withTimeout(
    (async () => {
      const rows = asFileRows(
        await session.db.exec(`SELECT * FROM ${sqlTable(name)}`)
      );
      return splitRepoRows(rows);
    })(),
    30_000,
    "Files"
  );
}

export async function listRepoFiles(
  session: ChainSession,
  repo: string
): Promise<RepoFileRow[]> {
  return (await listRepoState(session, repo)).files;
}

export async function saveFile(
  session: ChainSession,
  repo: string,
  rawPath: string,
  body: string,
  onStatus: StatusFn = () => {},
  opts: { author?: string; message?: string } = {}
): Promise<RepoState> {
  const name = tableName(repo);
  const path = assertFilePath(rawPath);
  const bytes = utf8Bytes(body);
  if (bytes > TEXT_MAX_BYTES) {
    throw new Error(`${path} is ${bytes} bytes. Max is ${TEXT_MAX_BYTES}`);
  }
  return withTimeout(
    (async () => {
      const rows = await session.db.exec(
        `SELECT * FROM ${sqlTable(name)} WHERE path = $1`,
        [path]
      );
      const prev = typeof rows[0]?.body === "string" ? rows[0].body : null;
      if (prev === body) {
        return listRepoState(session, name);
      }
      onStatus(`Writing ${path}`);
      if (prev != null) {
        await session.db.exec(
          `UPDATE ${sqlTable(name)} SET body = $1 WHERE path = $2`,
          [body, path]
        );
      } else {
        await session.db.exec(
          `INSERT INTO ${sqlTable(name)} (path, body) VALUES ($1, $2)`,
          [path, body]
        );
      }
      await recordCommit(
        session.db,
        name,
        [{ path, action: prev == null ? "add" : "update", body }],
        opts.message?.trim()
          ? normalizeCommitMessage(opts.message)
          : prev == null
            ? `Add ${path}`
            : `Update ${path}`,
        opts.author?.trim() || ""
      );
      onStatus("");
      return listRepoState(session, name);
    })(),
    90_000,
    "File"
  );
}

export async function deleteFile(
  session: ChainSession,
  repo: string,
  rawPath: string,
  onStatus: StatusFn = () => {},
  opts: { author?: string; message?: string } = {}
): Promise<RepoState> {
  const name = tableName(repo);
  const path = assertFilePath(rawPath);
  return withTimeout(
    (async () => {
      const rows = await session.db.exec(
        `SELECT * FROM ${sqlTable(name)} WHERE path = $1`,
        [path]
      );
      if (!rows[0]) {
        return listRepoState(session, name);
      }
      onStatus(`Deleting ${path}`);
      await session.db.exec(`DELETE FROM ${sqlTable(name)} WHERE path = $1`, [path]);
      await recordCommit(
        session.db,
        name,
        [{ path, action: "delete" }],
        opts.message?.trim()
          ? normalizeCommitMessage(opts.message)
          : `Delete ${path}`,
        opts.author?.trim() || ""
      );
      onStatus("");
      return listRepoState(session, name);
    })(),
    90_000,
    "Delete"
  );
}

export async function saveDescription(
  session: ChainSession,
  repo: string,
  raw: { description: string; website?: string },
  onStatus: StatusFn = () => {}
): Promise<RepoState> {
  const name = tableName(repo);
  const description = normalizeDescription(raw.description);
  const website = (raw.website ?? "").trim()
    ? normalizeWebsite(raw.website ?? "")
    : "";
  const next = serializeAboutBody({ description, website });
  return withTimeout(
    (async () => {
      const rows = await session.db.exec(
        `SELECT * FROM ${sqlTable(name)} WHERE path = $1`,
        [ABOUT_PATH]
      );
      const prevBody = typeof rows[0]?.body === "string" ? rows[0].body : "";
      const prev = parseAboutBody(prevBody);
      if (prev.description === description && prev.website === website) {
        return listRepoState(session, name);
      }
      onStatus("Saving description");
      if (!next) {
        if (rows[0]) {
          await session.db.exec(
            `DELETE FROM ${sqlTable(name)} WHERE path = $1`,
            [ABOUT_PATH]
          );
        }
      } else if (rows[0]) {
        await session.db.exec(
          `UPDATE ${sqlTable(name)} SET body = $1 WHERE path = $2`,
          [next, ABOUT_PATH]
        );
      } else {
        await session.db.exec(
          `INSERT INTO ${sqlTable(name)} (path, body) VALUES ($1, $2)`,
          [ABOUT_PATH, next]
        );
      }
      onStatus("");
      return listRepoState(session, name);
    })(),
    90_000,
    "Description"
  );
}

export async function renameRepo(
  session: ChainSession,
  fromRaw: string,
  toRaw: string,
  onStatus: StatusFn = () => {}
): Promise<HomeState> {
  const from = tableName(fromRaw);
  const to = assertRepoName(toRaw);
  if (from === to) {
    const next = await snapshot(session.db, session.erUrl);
    return {
      session: next,
      repos: next.rels,
      active: to,
      readme: await readmeBody(next.db, to),
    };
  }
  if (session.rels.some((rel) => rel.name === to)) {
    throw new Error("You already have this repo");
  }
  return withTimeout(
    (async () => {
      onStatus(`CREATE TABLE ${to}`);
      await session.db.exec(`CREATE TABLE ${sqlTable(to)} ${FILES_SQL}`);
      const rows = asFileRows(
        await session.db.exec(`SELECT * FROM ${sqlTable(from)}`)
      );
      for (const row of rows) {
        onStatus(`Copy ${row.path}`);
        await session.db.exec(
          `INSERT INTO ${sqlTable(to)} (path, body) VALUES ($1, $2)`,
          [row.path, row.body]
        );
      }
      onStatus(`DROP TABLE ${from}`);
      await session.db.exec(`DROP TABLE ${sqlTable(from)}`);
      const next = await snapshot(session.db, session.erUrl);
      onStatus("");
      return {
        session: next,
        repos: next.rels,
        active: to,
        readme: await readmeBody(next.db, to),
      };
    })(),
    90_000,
    "Rename"
  );
}

export async function deleteRepo(
  session: ChainSession,
  rawName: string,
  onStatus: StatusFn = () => {}
): Promise<HomeState> {
  const name = tableName(rawName);
  return withTimeout(
    (async () => {
      onStatus(`DROP TABLE ${name}`);
      await session.db.exec(`DROP TABLE ${sqlTable(name)}`);
      const next = await snapshot(session.db, session.erUrl);
      onStatus("");
      return {
        session: next,
        repos: next.rels,
        active: HOME_REPO,
        readme: await readmeBody(next.db, HOME_REPO),
      };
    })(),
    90_000,
    "Delete repo"
  );
}
