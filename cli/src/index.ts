#!/usr/bin/env bun
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { TEXT_MAX_BYTES } from "slabdb";
import { ensureRepo, listFiles, openDb, upsertFiles } from "./chain";
import { extractOptions } from "./args";
import { HELP } from "./help";
import { cmdLogin, cmdLogout } from "./login";
import { lookupClaim, parseRemote, parseRemoteUrl } from "./remote";
import { makeCommitId } from "./history";
import {
  README_PATH,
  assertRepoName,
  findRoot,
  initRoot,
  loadCommit,
  loadConfig,
  loadIndex,
  repoRelPath,
  saveCommit,
  saveConfig,
  saveIndex,
  snapshotHash,
  type SlabCommit,
  type StagedFile,
} from "./repo";
import {
  defaultApi,
  loadCredentials,
  pushCommit,
} from "./auth";
import { loadWallet } from "./wallet";

const SKIP = new Set([
  ".slab",
  ".git",
  "node_modules",
  "dist",
  "target",
  ".DS_Store",
  ".env",
  ".history",
]);

function fail(err: unknown): never {
  const msg = err instanceof Error ? err.message : String(err);
  process.stderr.write(`${msg}\n`);
  process.exit(1);
}

function isBinary(buf: Buffer): boolean {
  return buf.includes(0);
}

function collectFiles(root: string, target: string): StagedFile[] {
  const abs = resolve(root, target);
  if (!existsSync(abs)) {
    throw new Error(`No such file: ${target}`);
  }
  const st = statSync(abs);
  if (st.isDirectory()) {
    const out: StagedFile[] = [];
    for (const name of readdirSync(abs)) {
      if (SKIP.has(name)) {
        continue;
      }
      out.push(...collectFiles(root, join(target, name)));
    }
    return out;
  }
  const buf = readFileSync(abs);
  if (isBinary(buf)) {
    process.stderr.write(`skip binary ${target}\n`);
    return [];
  }
  const body = buf.toString("utf8");
  const bytes = Buffer.byteLength(body, "utf8");
  if (bytes > TEXT_MAX_BYTES) {
    throw new Error(`${target} is ${bytes} bytes. Max is ${TEXT_MAX_BYTES}`);
  }
  return [{ path: repoRelPath(root, abs), body }];
}

function defaultRepoName(dir: string): string {
  const base = basename(resolve(dir))
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (/^[a-z][a-z0-9_-]{0,31}$/.test(base) && !base.endsWith("-") && !base.includes("--")) {
    return base;
  }
  return "home";
}

function cmdInit(args: string[]) {
  const dir = process.cwd();
  if (existsSync(join(dir, ".slab", "config.json"))) {
    throw new Error("Already a Slab repo");
  }
  const repo = assertRepoName(args[0] || defaultRepoName(dir));
  const root = initRoot(dir, repo);
  const readme = join(root, README_PATH);
  if (!existsSync(readme)) {
    writeFileSync(readme, `# ${repo}\n`);
  }
  process.stdout.write(`Initialized Slab repo ${repo}\n`);
}

async function cmdClone(args: string[], keypair?: string) {
  const specRaw = args[0];
  if (!specRaw) {
    throw new Error("Usage: slab clone <uid[/repo]> [dir]");
  }
  const spec = parseRemote(specRaw);
  const dest = resolve(
    args[1] || (spec.repo === "home" ? spec.uid : `${spec.uid}-${spec.repo}`)
  );
  if (existsSync(join(dest, ".slab", "config.json"))) {
    throw new Error(`${dest} is already a Slab repo`);
  }
  if (existsSync(dest) && readdirSync(dest).length > 0) {
    throw new Error(`${dest} is not empty`);
  }
  const claim = await lookupClaim(spec.uid);
  let files: StagedFile[] = [];
  try {
    const wallet = loadWallet(keypair);
    const client = await openDb(
      wallet,
      { ns: "home", owner: claim.wallet },
      { autoDelegate: false }
    );
    files = await listFiles(client, spec.repo);
  } catch (err) {
    if (!claim.readme) {
      throw err;
    }
  }
  if (files.length === 0 && claim.readme) {
    files = [{ path: README_PATH, body: claim.readme }];
  }
  mkdirSync(dest, { recursive: true });
  initRoot(dest, spec.repo, claim.wallet);
  saveConfig(dest, {
    ns: "home",
    repo: spec.repo,
    owner: claim.wallet,
    uid: spec.uid,
    remote: `${defaultApi()}/${spec.uid}/${spec.repo}`,
  });
  for (const file of files) {
    const path = join(dest, file.path);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, file.body);
  }
  process.stdout.write(
    `Cloned ${spec.uid}/${spec.repo} into ${dest} (${files.length} file${files.length === 1 ? "" : "s"})\n`
  );
}

function cmdAdd(args: string[]) {
  if (args.length === 0) {
    throw new Error("Usage: slab add <path...>");
  }
  const root = findRoot();
  const index = loadIndex(root);
  const next = new Map(index.staged.map((file) => [file.path, file]));
  for (const target of args) {
    for (const file of collectFiles(root, target)) {
      next.set(file.path, file);
    }
  }
  const staged = [...next.values()].sort((a, b) => a.path.localeCompare(b.path));
  saveIndex(root, { staged });
  process.stdout.write(
    `Staged ${staged.length} file${staged.length === 1 ? "" : "s"}\n`
  );
}

function cmdCommit(args: string[], message?: string) {
  if (!message?.trim()) {
    throw new Error("Usage: slab commit -m <message>");
  }
  if (args.length > 0) {
    throw new Error("Usage: slab commit -m <message>");
  }
  const root = findRoot();
  const config = loadConfig(root);
  const index = loadIndex(root);
  if (index.staged.length === 0) {
    throw new Error("Nothing staged. Run slab add first.");
  }
  const creds = loadCredentials();
  const created_at = new Date().toISOString();
  const parent = config.head ?? null;
  const id = makeCommitId(
    `${config.repo}:${parent}:${created_at}:${message.trim()}:${index.staged
      .map((file) => file.path)
      .sort()
      .join("|")}`
  );
  const commit: SlabCommit = {
    id,
    parent,
    message: message.trim(),
    created_at,
    author: creds?.uid || "",
    files: index.staged,
  };
  saveCommit(root, commit);
  saveIndex(root, { staged: [] });
  process.stdout.write(
    `[${id}] ${commit.message} (${commit.files.length} file${commit.files.length === 1 ? "" : "s"})\n`
  );
}

function cmdRemote(args: string[]) {
  const root = findRoot();
  const config = loadConfig(root);
  if (args.length === 0) {
    if (!config.remote) {
      throw new Error("No remote. Run slab remote add <url>");
    }
    process.stdout.write(`origin\t${config.remote}\n`);
    return;
  }
  if (args[0] !== "add") {
    throw new Error("Usage: slab remote add [origin] <url>");
  }
  const urlRaw = args.length >= 3 ? args[2] : args[1];
  if (!urlRaw) {
    throw new Error("Usage: slab remote add [origin] <url>");
  }
  const remote = parseRemoteUrl(urlRaw);
  saveConfig(root, {
    ...config,
    repo: remote.repo,
    uid: remote.uid,
    remote: remote.url,
  });
  process.stdout.write(`Remote origin ${remote.url}\n`);
}

function withCommitId(
  commit: SlabCommit,
  repo: string,
  head?: string
): SlabCommit {
  if (commit.id && commit.created_at) {
    return commit;
  }
  const created_at = commit.created_at || new Date().toISOString();
  const parent = commit.parent ?? head ?? null;
  const message = commit.message;
  const id = makeCommitId(
    `${repo}:${parent}:${created_at}:${message}:${commit.files
      .map((file) => file.path)
      .sort()
      .join("|")}`
  );
  return {
    id,
    parent,
    message,
    created_at,
    author: commit.author || "",
    files: commit.files,
  };
}

async function cmdPush(keypair?: string) {
  const root = findRoot();
  const config = loadConfig(root);
  const pending = loadCommit(root);
  if (!pending || pending.files.length === 0) {
    throw new Error("Nothing to push. Run slab commit first.");
  }
  const commit = withCommitId(pending, config.repo, config.head);
  if (keypair) {
    await cmdPushKeypair(keypair, root, config, commit);
    return;
  }
  if (!config.remote) {
    throw new Error("No remote. Run slab remote add <url>");
  }
  const remote = parseRemoteUrl(config.remote);
  const creds = loadCredentials();
  if (!creds) {
    throw new Error("Run slab login first");
  }
  if (creds.api !== remote.api) {
    throw new Error(
      `This remote is ${remote.api}. You are logged in to ${creds.api}. Run slab login --api ${remote.api}`
    );
  }
  if (creds.uid !== remote.uid) {
    throw new Error(
      `Logged in as ${creds.uid}. This remote belongs to ${remote.uid}.`
    );
  }
  if (config.head === commit.id) {
    process.stdout.write("Everything up to date\n");
    return;
  }
  const result = await pushCommit(creds.api, creds.token, {
    uid: remote.uid,
    repo: remote.repo,
    commit: {
      id: commit.id,
      parent: commit.parent,
      message: commit.message,
      created_at: commit.created_at,
      author: commit.author || creds.uid,
      files: commit.files,
    },
  });
  saveConfig(root, {
    ...config,
    uid: remote.uid,
    repo: remote.repo,
    owner: creds.wallet,
    remote: remote.url,
    head: result.id,
    pushed: snapshotHash(commit.files),
  });
  saveCommit(root, commit);
  if (result.wrote === 0) {
    process.stdout.write(
      `Pushed ${result.id} to ${result.uid}/${result.repo}\n`
    );
  } else {
    process.stdout.write(
      `Pushed ${result.wrote} file${result.wrote === 1 ? "" : "s"} to ${result.uid}/${result.repo} (${result.id})\n`
    );
  }
  process.stdout.write(`${remote.url}\n`);
}

async function cmdPushKeypair(
  keypair: string,
  root: string,
  config: ReturnType<typeof loadConfig>,
  commit: SlabCommit
) {
  const hash = snapshotHash(commit.files);
  if (config.pushed === hash) {
    process.stdout.write("Everything up to date\n");
    return;
  }
  const wallet = loadWallet(keypair);
  if (config.owner && config.owner !== wallet.publicKey.toBase58()) {
    throw new Error(
      `This repo is owned by ${config.owner}. You can only push a repo you own.`
    );
  }
  const client = await openDb(
    wallet,
    { ns: config.ns, owner: config.owner || wallet.publicKey.toBase58() },
    { autoDelegate: true }
  );
  await ensureRepo(client, config.repo);
  const wrote = await upsertFiles(client, config.repo, commit.files, {
    message: commit.message,
    author: config.uid || wallet.publicKey.toBase58(),
  });
  saveConfig(root, {
    ...config,
    owner: config.owner || wallet.publicKey.toBase58(),
    head: commit.id,
    pushed: hash,
  });
  process.stdout.write(
    `Pushed ${wrote} file${wrote === 1 ? "" : "s"} to ${config.repo}\n`
  );
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.length === 0 || argv[0] === "-h" || argv[0] === "--help" || argv[0] === "help") {
    process.stdout.write(HELP);
    process.exit(argv.length === 0 ? 1 : 0);
  }
  const { rest, keypair, message, api, token } = extractOptions(argv);
  const cmd = rest.shift() ?? "";
  const args = rest;
  try {
    if (cmd === "init") {
      cmdInit(args);
      return;
    }
    if (cmd === "clone") {
      await cmdClone(args, keypair);
      return;
    }
    if (cmd === "login") {
      await cmdLogin({ api, token });
      return;
    }
    if (cmd === "logout") {
      await cmdLogout();
      return;
    }
    if (cmd === "remote") {
      cmdRemote(args);
      return;
    }
    if (cmd === "add") {
      cmdAdd(args);
      return;
    }
    if (cmd === "commit") {
      cmdCommit(args, message);
      return;
    }
    if (cmd === "push") {
      await cmdPush(keypair);
      return;
    }
    throw new Error(`Unknown command ${cmd}\n\n${HELP}`);
  } catch (err) {
    fail(err);
  }
}

void main();
