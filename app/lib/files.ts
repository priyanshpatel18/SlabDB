import { HOME_REPO, PROFILE_TABLE, USERS_TABLE } from "@/lib/cluster";
import { isHistoryPath } from "@/lib/history";

export const ABOUT_PATH = ".about";
export const DESC_MAX = 200;

export const MAX_FILE_PATH = 256;
export const MAX_FILE_SEGMENTS = 16;

export type RepoFileRow = {
  path: string;
  body: string;
};

export type TreeEntry =
  | { kind: "dir"; name: string; path: string; files: number }
  | { kind: "file"; name: string; path: string; bytes: number };

const SEGMENT = /^[A-Za-z0-9._+-]+$/;
const REPO_NAME_RE = /^[a-z][a-z0-9_-]{0,31}$/;

export function isUserRepo(name: string): boolean {
  return name !== HOME_REPO && name !== PROFILE_TABLE && name !== USERS_TABLE;
}

export function isRepoName(raw: string): boolean {
  const name = raw.trim().toLowerCase();
  return REPO_NAME_RE.test(name) && !name.endsWith("-") && !name.includes("--");
}

export function sqlTable(name: string): string {
  if (/^[a-z_][a-z0-9_]*$/.test(name)) {
    return name;
  }
  if (!name || /["\\\s]/.test(name)) {
    throw new Error("Invalid table name");
  }
  return `"${name}"`;
}

export function normalizeRepoName(raw: string): string {
  return decodeURIComponent(raw).trim().toLowerCase();
}

export function parseRepoParam(raw: string): string | null {
  const name = normalizeRepoName(raw);
  if (!isRepoName(name) || !isUserRepo(name)) {
    return null;
  }
  return name;
}

export function utf8Bytes(text: string): number {
  return new TextEncoder().encode(text).length;
}

export function formatBytes(n: number): string {
  if (n < 1024) {
    return `${n} B`;
  }
  return `${(n / 1024).toFixed(1)} KB`;
}

export function isMarkdownPath(path: string): boolean {
  return /\.(md|markdown)$/i.test(path);
}

export function fileName(path: string): string {
  const i = path.lastIndexOf("/");
  return i < 0 ? path : path.slice(i + 1);
}

export function parentDir(path: string): string {
  const i = path.lastIndexOf("/");
  return i < 0 ? "" : path.slice(0, i);
}

export function joinPath(dir: string, name: string): string {
  if (!dir) {
    return name;
  }
  if (!name) {
    return dir;
  }
  return `${dir.replace(/\/+$/, "")}/${name.replace(/^\/+/, "")}`;
}

export function encodeRepoPath(path: string): string {
  return path
    .split("/")
    .filter(Boolean)
    .map((part) => encodeURIComponent(part))
    .join("/");
}

export function decodeRepoPath(segments: string[]): string {
  return segments.map((part) => decodeURIComponent(part)).join("/");
}

export function repoHref(uid: string, repo: string): string {
  return `/${encodeURIComponent(uid)}/${encodeURIComponent(repo)}`;
}

export function isHiddenPath(path: string): boolean {
  return isHistoryPath(path) || path === ABOUT_PATH;
}

export function normalizeDescription(raw: string): string {
  return raw.replace(/\s+/g, " ").trim().slice(0, DESC_MAX);
}

export function settingsHref(uid: string, repo: string): string {
  return `${repoHref(uid, repo)}/settings`;
}

export function commitsHref(uid: string, repo: string): string {
  return `${repoHref(uid, repo)}/commits`;
}

export function commitHref(uid: string, repo: string, id: string): string {
  return `${repoHref(uid, repo)}/commit/${encodeURIComponent(id)}`;
}

export function blobHref(uid: string, repo: string, path: string): string {
  return `${repoHref(uid, repo)}/blob/${encodeRepoPath(path)}`;
}

export function treeHref(uid: string, repo: string, dir: string): string {
  if (!dir) {
    return repoHref(uid, repo);
  }
  return `${repoHref(uid, repo)}/tree/${encodeRepoPath(dir)}`;
}

export function newFileHref(uid: string, repo: string, dir = ""): string {
  const base = `${repoHref(uid, repo)}/new`;
  if (!dir) {
    return base;
  }
  return `${base}?filename=${encodeURIComponent(`${dir}/`)}`;
}

export function assertFilePath(raw: string): string {
  const path = raw.trim().replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  if (!path) {
    throw new Error("File path is required");
  }
  if (path.length > MAX_FILE_PATH) {
    throw new Error(`Path is longer than ${MAX_FILE_PATH} characters`);
  }
  const parts = path.split("/");
  if (parts.length > MAX_FILE_SEGMENTS) {
    throw new Error("Path has too many folders");
  }
  for (const part of parts) {
    if (!part || part === "." || part === "..") {
      throw new Error("Path cannot use . or ..");
    }
    if (!SEGMENT.test(part)) {
      throw new Error(
        "Path can use letters, numbers, ., _, +, -, and / between folders"
      );
    }
  }
  if (parts[0] === ".slab" || parts[0] === ".history" || parts[0] === ".about") {
    throw new Error("That path is reserved");
  }
  return path;
}

export function listDir(
  files: RepoFileRow[],
  dir: string
): { dirs: TreeEntry[]; files: TreeEntry[] } {
  const prefix = dir ? `${dir}/` : "";
  const dirs = new Map<string, number>();
  const outFiles: TreeEntry[] = [];
  for (const file of files) {
    if (isHiddenPath(file.path)) {
      continue;
    }
    if (prefix) {
      if (file.path === dir || !file.path.startsWith(prefix)) {
        continue;
      }
    }
    const rest = prefix ? file.path.slice(prefix.length) : file.path;
    const slash = rest.indexOf("/");
    if (slash >= 0) {
      const name = rest.slice(0, slash);
      dirs.set(name, (dirs.get(name) ?? 0) + 1);
      continue;
    }
    if (!rest) {
      continue;
    }
    outFiles.push({
      kind: "file",
      name: rest,
      path: file.path,
      bytes: utf8Bytes(file.body),
    });
  }
  const dirEntries: TreeEntry[] = [...dirs.entries()].map(([name, count]) => ({
    kind: "dir" as const,
    name,
    path: joinPath(dir, name),
    files: count,
  }));
  dirEntries.sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
  );
  outFiles.sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
  );
  return { dirs: dirEntries, files: outFiles };
}

export function findFile(
  files: RepoFileRow[],
  path: string
): RepoFileRow | null {
  return files.find((file) => file.path === path) ?? null;
}

export function dirReadmePath(dir: string): string {
  return dir ? `${dir}/README.md` : "README.md";
}

export function readmeTitle(body: string, fallback: string): string {
  for (const line of body.split("\n")) {
    const match = /^#\s+(.+)$/.exec(line.trim());
    if (match?.[1]) {
      return match[1].trim();
    }
  }
  return fallback;
}

export function readmeBlurb(body: string): string {
  let inFence = false;
  for (const raw of body.split("\n")) {
    const line = raw.trim();
    if (line.startsWith("```")) {
      inFence = !inFence;
      continue;
    }
    if (inFence || !line || line.startsWith("#") || line.startsWith(">")) {
      continue;
    }
    if (/^`[^`]+`$/.test(line)) {
      continue;
    }
    return line.replace(/^[-*]\s+/, "");
  }
  return "";
}

export function dirExists(files: RepoFileRow[], dir: string): boolean {
  if (!dir) {
    return true;
  }
  const prefix = `${dir}/`;
  return files.some((file) => file.path === dir || file.path.startsWith(prefix));
}

export type SideNode = {
  name: string;
  path: string;
  kind: "dir" | "file";
  children: SideNode[];
};

export function buildSideTree(files: RepoFileRow[]): SideNode[] {
  const root: SideNode[] = [];
  const dirs = new Map<string, SideNode>();

  function ensureDir(dir: string): SideNode[] {
    if (!dir) {
      return root;
    }
    const existing = dirs.get(dir);
    if (existing) {
      return existing.children;
    }
    const parent = parentDir(dir);
    const siblings = ensureDir(parent);
    const node: SideNode = {
      name: fileName(dir),
      path: dir,
      kind: "dir",
      children: [],
    };
    siblings.push(node);
    dirs.set(dir, node);
    return node.children;
  }

  for (const file of files) {
    if (isHiddenPath(file.path)) {
      continue;
    }
    const siblings = ensureDir(parentDir(file.path));
    siblings.push({
      name: fileName(file.path),
      path: file.path,
      kind: "file",
      children: [],
    });
  }

  function sortNodes(nodes: SideNode[]) {
    nodes.sort((a, b) => {
      if (a.kind !== b.kind) {
        return a.kind === "dir" ? -1 : 1;
      }
      return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    });
    for (const node of nodes) {
      sortNodes(node.children);
    }
  }
  sortNodes(root);
  return root;
}
