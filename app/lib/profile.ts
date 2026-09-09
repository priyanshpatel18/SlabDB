"use client";

import { isAlreadyPrepared } from "slabdb";
import type { StatusFn } from "slabdb/web";
import {
  IRYS_GATEWAY,
  PROFILE_ROW,
  PROFILE_TABLE,
  USERS_TABLE,
  isReservedUsername,
} from "@/lib/cluster";
import type { ChainSession } from "@/lib/session";
import { uploadPfp } from "@/lib/pfp";
import { writeProfileCache } from "@/lib/profile-cache";
import { claimUsername } from "@/lib/username";
import type { SlabSigner } from "@/lib/wallet";

export type Profile = {
  uid: string;
  name: string;
  bio: string;
  website: string;
  pfp: string;
  links: string[];
};

export type ProfileDraft = Profile & {
  pfpFile?: File | null;
};

export const PROFILE_SQL = `(id text PRIMARY KEY, uid text NOT NULL, name text NOT NULL, bio text, website text, pfp text, link1 text, link2 text, link3 text, link4 text, link5 text)`;
export const USERS_SQL = `(username text PRIMARY KEY, wallet text NOT NULL, name text NOT NULL, bio text, website text, pfp text, link1 text, link2 text, link3 text, link4 text, link5 text)`;

const EMPTY: Profile = {
  uid: "",
  name: "",
  bio: "",
  website: "",
  pfp: "",
  links: ["", "", "", "", ""],
};

function isAlreadyThere(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /already exists|already present|duplicate|unique/i.test(msg);
}

function isDuplicateKey(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /duplicate primary key|duplicateKey|Custom":\s*6009|0x1779|error: 6009/i.test(
    msg
  );
}

export function emptyProfile(): Profile {
  return {
    ...EMPTY,
    links: ["", "", "", "", ""],
  };
}

export function pfpSrc(id: string): string {
  const raw = id.trim();
  if (!raw) {
    return "";
  }
  if (/^https?:\/\//i.test(raw)) {
    return raw;
  }
  return `${IRYS_GATEWAY.replace(/\/$/, "")}/${raw}`;
}

export function assertUid(raw: string): string {
  const uid = raw.trim().toLowerCase();
  if (!/^[a-z][a-z0-9_]{2,31}$/.test(uid)) {
    throw new Error(
      "Username must start with a letter, use a-z 0-9 _, and be 3 to 32 characters"
    );
  }
  if (isReservedUsername(uid) || uid === USERS_TABLE) {
    throw new Error("That username is reserved");
  }
  return uid;
}

export function assertDisplayName(raw: string): string {
  const name = raw.trim();
  if (name.length < 1 || name.length > 64) {
    throw new Error("Display name must be 1 to 64 characters");
  }
  return name;
}

function cleanUrl(raw: string): string {
  const value = raw.trim();
  if (!value) {
    return "";
  }
  if (!/^https?:\/\//i.test(value)) {
    return `https://${value}`;
  }
  try {
    new URL(value);
  } catch {
    throw new Error(`Not a valid URL: ${value}`);
  }
  return value;
}

export function normalizeProfile(draft: ProfileDraft): Profile {
  const links = [...draft.links];
  while (links.length < 5) {
    links.push("");
  }
  return {
    uid: assertUid(draft.uid),
    name: assertDisplayName(draft.name),
    bio: draft.bio.trim().slice(0, 160),
    website: draft.website.trim() ? cleanUrl(draft.website) : "",
    pfp: draft.pfp.trim(),
    links: links.slice(0, 5).map((link) => (link.trim() ? cleanUrl(link) : "")),
  };
}

function rowToProfile(row: Record<string, unknown> | undefined): Profile | null {
  if (!row) {
    return null;
  }
  const uid = typeof row.uid === "string" ? row.uid : "";
  const name = typeof row.name === "string" ? row.name : "";
  if (!uid || !name) {
    return null;
  }
  return {
    uid,
    name,
    bio: typeof row.bio === "string" ? row.bio : "",
    website: typeof row.website === "string" ? row.website : "",
    pfp: typeof row.pfp === "string" ? row.pfp : "",
    links: [
      typeof row.link1 === "string" ? row.link1 : "",
      typeof row.link2 === "string" ? row.link2 : "",
      typeof row.link3 === "string" ? row.link3 : "",
      typeof row.link4 === "string" ? row.link4 : "",
      typeof row.link5 === "string" ? row.link5 : "",
    ],
  };
}

export async function ensureProfileTable(
  db: ChainSession["db"],
  onStatus: StatusFn = () => {}
): Promise<void> {
  const rels = (await db.catalog()).rels;
  if (!rels.some((rel) => rel.name === PROFILE_TABLE)) {
    onStatus("CREATE TABLE profile");
    try {
      await db.exec(`CREATE TABLE ${PROFILE_TABLE} ${PROFILE_SQL}`);
    } catch (err) {
      if (!isAlreadyThere(err) && !isAlreadyPrepared(err)) {
        throw err;
      }
    }
  }
  const nextRels = (await db.catalog()).rels;
  if (nextRels.some((rel) => rel.name === USERS_TABLE)) {
    return;
  }
  onStatus("CREATE TABLE users");
  try {
    await db.exec(`CREATE TABLE ${USERS_TABLE} ${USERS_SQL}`);
  } catch (err) {
    if (!isAlreadyThere(err) && !isAlreadyPrepared(err)) {
      throw err;
    }
  }
}

export async function loadProfile(
  db: ChainSession["db"]
): Promise<Profile | null> {
  try {
    const rows = await db.exec(`SELECT * FROM ${PROFILE_TABLE} WHERE id = $1`, [
      PROFILE_ROW,
    ]);
    return rowToProfile(rows[0]);
  } catch {
    return null;
  }
}

export async function saveProfile(
  session: ChainSession,
  wallet: SlabSigner,
  draft: ProfileDraft,
  onStatus: StatusFn = () => {},
  extras: { readme?: string } = {}
): Promise<Profile> {
  const next = normalizeProfile(draft);
  if (draft.pfpFile) {
    onStatus("Uploading photo");
    next.pfp = await uploadPfp(wallet, draft.pfpFile, onStatus);
  }
  const existing = await loadProfile(session.db);
  const address = wallet.publicKey.toBase58();
  await claimUsername(
    wallet,
    next,
    { readme: extras.readme ?? "", previousUid: existing?.uid },
    onStatus
  );
  await upsertUserRow(session, address, next, existing?.uid, onStatus);
  const values = [
    next.uid,
    next.name,
    next.bio,
    next.website,
    next.pfp,
    next.links[0] ?? "",
    next.links[1] ?? "",
    next.links[2] ?? "",
    next.links[3] ?? "",
    next.links[4] ?? "",
  ];
  onStatus("Saving profile");
  if (existing) {
    await session.db.exec(
      `UPDATE ${PROFILE_TABLE} SET uid = $1, name = $2, bio = $3, website = $4, pfp = $5, link1 = $6, link2 = $7, link3 = $8, link4 = $9, link5 = $10 WHERE id = $11`,
      [...values, PROFILE_ROW]
    );
  } else {
    await session.db.exec(
      `INSERT INTO ${PROFILE_TABLE} (id, uid, name, bio, website, pfp, link1, link2, link3, link4, link5) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [PROFILE_ROW, ...values]
    );
  }
  writeProfileCache(address, next);
  onStatus("");
  return next;
}

async function upsertUserRow(
  session: ChainSession,
  wallet: string,
  next: Profile,
  previousUid: string | undefined,
  onStatus: StatusFn
) {
  const values = [
    next.uid,
    wallet,
    next.name,
    next.bio,
    next.website,
    next.pfp,
    next.links[0] ?? "",
    next.links[1] ?? "",
    next.links[2] ?? "",
    next.links[3] ?? "",
    next.links[4] ?? "",
  ];
  onStatus("CREATE TABLE users");
  await ensureProfileTable(session.db, onStatus);
  if (previousUid && previousUid !== next.uid) {
    try {
      await session.db.exec(`DELETE FROM ${USERS_TABLE} WHERE username = $1`, [
        previousUid,
      ]);
    } catch {
      // username row may not exist yet
    }
  }
  onStatus("INSERT INTO users");
  try {
    await session.db.exec(
      `INSERT INTO ${USERS_TABLE} (username, wallet, name, bio, website, pfp, link1, link2, link3, link4, link5) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      values
    );
  } catch (err) {
    if (!isDuplicateKey(err) && !isAlreadyThere(err)) {
      throw err;
    }
    const rows = await session.db.exec(
      `SELECT * FROM ${USERS_TABLE} WHERE username = $1`,
      [next.uid]
    );
    const owner = typeof rows[0]?.wallet === "string" ? rows[0].wallet : "";
    if (owner && owner !== wallet) {
      throw new Error("Username is taken");
    }
    await session.db.exec(
      `UPDATE ${USERS_TABLE} SET wallet = $2, name = $3, bio = $4, website = $5, pfp = $6, link1 = $7, link2 = $8, link3 = $9, link4 = $10, link5 = $11 WHERE username = $1`,
      values
    );
  }
}
