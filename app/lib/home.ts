"use client";

import { Buffer } from "buffer";
import { isAlreadyPrepared, withTimeout, type RelInfo } from "slabdb";
import { Slab, BrowserIrysPageStore, type StatusFn } from "slabdb/web";
import { HOME_NS, HOME_REPO, README_PATH } from "@/lib/cluster";
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
  if (!/^[a-z][a-z0-9_]{0,31}$/.test(name)) {
    throw new Error(
      "Repo name must start with a letter and use only a-z, 0-9, and _"
    );
  }
  if (name === HOME_REPO || name === "profile" || name === "users") {
    throw new Error(`${name} is reserved`);
  }
  return name;
}

export function defaultReadme(repo: string, address: string): string {
  return [`# ${repo}`, "", `\`${address}\``, ""].join("\n");
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
  const rows = await db.exec(`SELECT * FROM ${repo} WHERE path = $1`, [
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
    await db.exec(`UPDATE ${repo} SET body = $1 WHERE path = $2`, [
      next,
      README_PATH,
    ]);
    return next;
  }
  try {
    await db.exec(`INSERT INTO ${repo} (path, body) VALUES ($1, $2)`, [
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
        `SELECT * FROM ${name} WHERE path = $1`,
        [README_PATH]
      );
      if (rows[0]) {
        await session.db.exec(`UPDATE ${name} SET body = $1 WHERE path = $2`, [
          body,
          README_PATH,
        ]);
      } else {
        await session.db.exec(
          `INSERT INTO ${name} (path, body) VALUES ($1, $2)`,
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
  onStatus: StatusFn = () => {}
): Promise<HomeState> {
  const name = assertRepoName(rawName);
  return withTimeout(
    (async () => {
      onStatus(`CREATE TABLE ${name}`);
      await session.db.exec(`CREATE TABLE ${name} ${FILES_SQL}`);
      await ensureReadme(session.db, name, address, onStatus);
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
