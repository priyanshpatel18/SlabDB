import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";

export const SLAB_DIR = ".slab";
export const FILES_SQL = "(path text PRIMARY KEY, body text NOT NULL)";
export const HOME_NS = "home";
export const HOME_REPO = "home";
export const README_PATH = "README.md";

export type SlabConfig = {
  ns: string;
  repo: string;
  owner: string;
  uid?: string;
  pushed?: string;
};

export type StagedFile = {
  path: string;
  body: string;
};

export type SlabIndex = {
  staged: StagedFile[];
};

export type SlabCommit = {
  message: string;
  files: StagedFile[];
};

function readJson<T>(path: string): T | null {
  if (!existsSync(path)) {
    return null;
  }
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function writeJson(path: string, value: unknown) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
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

export function assertRepoName(raw: string): string {
  const name = raw.trim().toLowerCase();
  if (
    !/^[a-z][a-z0-9_-]{0,31}$/.test(name) ||
    name.endsWith("-") ||
    name.includes("--")
  ) {
    throw new Error(
      "Repo name must start with a letter and use a-z, 0-9, -, and _"
    );
  }
  if (name === "profile" || name === "users") {
    throw new Error(`${name} is reserved`);
  }
  return name;
}

export function findRoot(start = process.cwd()): string {
  let dir = resolve(start);
  while (true) {
    if (existsSync(join(dir, SLAB_DIR, "config.json"))) {
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) {
      throw new Error("Not a Slab repo. Run slab init or slab clone.");
    }
    dir = parent;
  }
}

export function configPath(root: string): string {
  return join(root, SLAB_DIR, "config.json");
}

export function indexPath(root: string): string {
  return join(root, SLAB_DIR, "index.json");
}

export function commitPath(root: string): string {
  return join(root, SLAB_DIR, "commit.json");
}

export function loadConfig(root: string): SlabConfig {
  const row = readJson<SlabConfig>(configPath(root));
  if (!row?.repo) {
    throw new Error("Broken .slab/config.json");
  }
  return row;
}

export function saveConfig(root: string, config: SlabConfig) {
  writeJson(configPath(root), config);
}

export function loadIndex(root: string): SlabIndex {
  return readJson<SlabIndex>(indexPath(root)) ?? { staged: [] };
}

export function saveIndex(root: string, index: SlabIndex) {
  writeJson(indexPath(root), index);
}

export function loadCommit(root: string): SlabCommit | null {
  return readJson<SlabCommit>(commitPath(root));
}

export function saveCommit(root: string, commit: SlabCommit) {
  writeJson(commitPath(root), commit);
}

export function repoRelPath(root: string, abs: string): string {
  const rel = relative(root, resolve(abs)).split(sep).join("/");
  if (!rel || rel === "." || rel.startsWith("..") || rel.startsWith("/")) {
    throw new Error(`Path is outside the repo: ${abs}`);
  }
  if (rel.startsWith(`${SLAB_DIR}/`) || rel === SLAB_DIR) {
    throw new Error("Do not add .slab");
  }
  if (rel.length > 256) {
    throw new Error("Path is too long");
  }
  return rel;
}

export function snapshotHash(files: StagedFile[]): string {
  const payload = files
    .slice()
    .sort((a, b) => a.path.localeCompare(b.path))
    .map((file) => `${file.path}\0${file.body}`)
    .join("\n");
  return Buffer.from(payload).toString("base64url").slice(0, 32);
}

export function initRoot(dir: string, repo: string, owner = ""): string {
  const root = resolve(dir);
  mkdirSync(join(root, SLAB_DIR), { recursive: true });
  saveConfig(root, { ns: HOME_NS, repo, owner });
  saveIndex(root, { staged: [] });
  return root;
}
