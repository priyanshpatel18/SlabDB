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
  files: CommitFile[];
};

const META_RE = /^\.history\/([a-f0-9]{8})\.json$/;
const BLOB_RE = /^\.history\/([a-f0-9]{8})\/(.+)$/;

export function isHistoryPath(path: string): boolean {
  return path === HISTORY_DIR || path.startsWith(`${HISTORY_DIR}/`);
}

export function commitMetaPath(id: string): string {
  return `${HISTORY_DIR}/${id}.json`;
}

export function commitBlobPath(id: string, filePath: string): string {
  return `${HISTORY_DIR}/${id}/${filePath}`;
}

export function parseMetaPath(path: string): string | null {
  return META_RE.exec(path)?.[1] ?? null;
}

export function parseBlobPath(
  path: string
): { id: string; path: string } | null {
  const match = BLOB_RE.exec(path);
  if (!match) {
    return null;
  }
  return { id: match[1], path: match[2] };
}

export async function makeCommitId(seed: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(seed)
  );
  return Array.from(new Uint8Array(digest))
    .slice(0, 4)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function parseCommitMeta(body: string): CommitRecord | null {
  try {
    const row = JSON.parse(body) as CommitRecord;
    if (!row?.id || !row.message || !Array.isArray(row.files)) {
      return null;
    }
    return {
      id: row.id,
      parent: row.parent ?? null,
      message: String(row.message),
      created_at: String(row.created_at || ""),
      author: String(row.author || ""),
      files: row.files.map((file) => ({
        path: String(file.path || ""),
        action: file.action === "delete" || file.action === "add" ? file.action : "update",
      })),
    };
  } catch {
    return null;
  }
}

export function latestCommitForPath(
  commits: CommitRecord[],
  path: string
): CommitRecord | null {
  for (const commit of commits) {
    if (
      commit.files.some(
        (file) => file.path === path || file.path.startsWith(`${path}/`)
      )
    ) {
      return commit;
    }
  }
  return null;
}

export function fileAtCommit(
  commits: CommitRecord[],
  commitId: string,
  path: string
): string | null {
  const ordered = [...commits].sort((a, b) =>
    a.created_at.localeCompare(b.created_at)
  );
  let body: string | null = null;
  for (const commit of ordered) {
    const file = commit.files.find((item) => item.path === path);
    if (file) {
      body = file.action === "delete" ? null : (file.body ?? body);
    }
    if (commit.id === commitId) {
      return body;
    }
  }
  return null;
}

export const COMMIT_MESSAGE_MAX = 256;

export function normalizeCommitMessage(raw: string): string {
  const message = raw.replace(/\s+/g, " ").trim();
  if (!message) {
    throw new Error("Commit message is required");
  }
  if (message.length > COMMIT_MESSAGE_MAX) {
    throw new Error(
      `Commit message is longer than ${COMMIT_MESSAGE_MAX} characters`
    );
  }
  return message;
}

export function suggestedCommitMessage(
  action: CommitAction,
  path: string
): string {
  const name = path.trim() || "file";
  if (action === "add") {
    return `Add ${name}`;
  }
  if (action === "delete") {
    return `Delete ${name}`;
  }
  return `Update ${name}`;
}

export function formatCommitStamp(iso: string): string {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) {
    return "";
  }
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatCommitDay(iso: string): string {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) {
    return "";
  }
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function groupCommitsByDay(
  commits: CommitRecord[]
): { day: string; commits: CommitRecord[] }[] {
  const groups: { day: string; commits: CommitRecord[] }[] = [];
  for (const commit of commits) {
    const label = formatCommitDay(commit.created_at);
    const day = label ? `Commits on ${label}` : "Commits";
    const last = groups[groups.length - 1];
    if (last && last.day === day) {
      last.commits.push(commit);
    } else {
      groups.push({ day, commits: [commit] });
    }
  }
  return groups;
}

export function formatCommittedOn(iso: string): string {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) {
    return "";
  }
  const includeYear = date.getFullYear() !== new Date().getFullYear();
  const label = date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(includeYear ? { year: "numeric" as const } : {}),
  });
  return `committed on ${label}`;
}

export function formatAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) {
    return "";
  }
  const sec = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (sec < 45) {
    return "just now";
  }
  const min = Math.round(sec / 60);
  if (min < 60) {
    return `${min} minute${min === 1 ? "" : "s"} ago`;
  }
  const hour = Math.round(min / 60);
  if (hour < 24) {
    return `${hour} hour${hour === 1 ? "" : "s"} ago`;
  }
  const day = Math.round(hour / 24);
  if (day < 30) {
    return `${day} day${day === 1 ? "" : "s"} ago`;
  }
  const month = Math.round(day / 30);
  if (month < 12) {
    return `${month} month${month === 1 ? "" : "s"} ago`;
  }
  const year = Math.round(month / 12);
  return `${year} year${year === 1 ? "" : "s"} ago`;
}
