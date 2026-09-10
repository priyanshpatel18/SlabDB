import { createHash } from "node:crypto";

export const HISTORY_DIR = ".history";

export type CommitAction = "add" | "update" | "delete";

export type CommitFile = {
  path: string;
  action: CommitAction;
  body?: string;
};

export type CommitRecord = {
  id: string;
  parent: string | null;
  message: string;
  created_at: string;
  author: string;
  files: { path: string; action: CommitAction }[];
};

export function isHistoryPath(path: string): boolean {
  return path === HISTORY_DIR || path.startsWith(`${HISTORY_DIR}/`);
}

export function commitMetaPath(id: string): string {
  return `${HISTORY_DIR}/${id}.json`;
}

export function commitBlobPath(id: string, filePath: string): string {
  return `${HISTORY_DIR}/${id}/${filePath}`;
}

export function makeCommitId(seed: string): string {
  return createHash("sha256").update(seed).digest("hex").slice(0, 8);
}

export function parseMetaPath(path: string): string | null {
  const match = /^\.history\/([a-f0-9]{8})\.json$/.exec(path);
  return match?.[1] ?? null;
}

export function parseCommitMeta(body: string): CommitRecord | null {
  try {
    const row = JSON.parse(body) as CommitRecord;
    if (!row?.id || !row.message || !Array.isArray(row.files)) {
      return null;
    }
    return row;
  } catch {
    return null;
  }
}
