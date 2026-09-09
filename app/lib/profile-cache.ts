"use client";

import type { Profile } from "@/lib/profile";

const PROFILE_KEY = "slab-profile:";
const PUBLIC_KEY = "slab-public:";
const NAME_INDEX_KEY = "slab-usernames";

export type CachedPublicProfile = Profile & {
  wallet: string;
  readme: string;
};

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    return;
  }
}

export function readProfileCache(wallet: string): Profile | null {
  if (!wallet) {
    return null;
  }
  const row = readJson<Profile>(PROFILE_KEY + wallet);
  if (!row?.uid || !row.name) {
    return null;
  }
  return {
    ...row,
    links: Array.isArray(row.links) ? row.links : ["", "", "", "", ""],
  };
}

export function writeProfileCache(wallet: string, profile: Profile) {
  if (!wallet || !profile.uid) {
    return;
  }
  writeJson(PROFILE_KEY + wallet, profile);
  writePublicCache({
    ...profile,
    wallet,
    readme: readPublicCache(profile.uid)?.readme ?? "",
  });
}

export function readPublicCache(uid: string): CachedPublicProfile | null {
  if (!uid) {
    return null;
  }
  const row = readJson<CachedPublicProfile>(PUBLIC_KEY + uid.toLowerCase());
  if (!row?.uid || !row.name || !row.wallet) {
    return null;
  }
  return {
    ...row,
    links: Array.isArray(row.links) ? row.links : ["", "", "", "", ""],
    readme: typeof row.readme === "string" ? row.readme : "",
  };
}

export function writePublicCache(row: CachedPublicProfile) {
  if (!row.uid || !row.wallet) {
    return;
  }
  writeJson(PUBLIC_KEY + row.uid.toLowerCase(), row);
  const index = readNameIndex();
  index[row.uid.toLowerCase()] = row.wallet;
  writeJson(NAME_INDEX_KEY, index);
}

export function readNameIndex(): Record<string, string> {
  return readJson<Record<string, string>>(NAME_INDEX_KEY) ?? {};
}

export function localWalletForUid(uid: string): string | null {
  const key = uid.trim().toLowerCase();
  if (!key) {
    return null;
  }
  return readNameIndex()[key] ?? null;
}

export function releaseLocalUid(uid: string, wallet: string) {
  const key = uid.trim().toLowerCase();
  const index = readNameIndex();
  if (index[key] === wallet) {
    delete index[key];
    writeJson(NAME_INDEX_KEY, index);
  }
  try {
    localStorage.removeItem(PUBLIC_KEY + key);
  } catch {
    return;
  }
}
