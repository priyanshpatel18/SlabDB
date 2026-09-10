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
import { HELP } from "./help";
import { lookupClaim, parseRemote } from "./remote";
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
  type StagedFile,
} from "./repo";
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

function extractOptions(argv: string[]) {
  const rest: string[] = [];
  let keypair: string | undefined;
  let message: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    const item = argv[i];
    if (item === "--keypair" || item === "-m" || item === "--message") {
      const value = argv[++i];
      if (!value || value.startsWith("-")) {
        throw new Error(`${item} needs a value`);
      }
      if (item === "--keypair") {
        keypair = value;
      } else {
        message = value;
      }
      continue;
    }
    if (item.startsWith("--keypair=")) {
      keypair = item.slice("--keypair=".length);
      continue;
    }
    if (item.startsWith("--message=")) {
      message = item.slice("--message=".length);
      continue;
    }
    rest.push(item);
  }
  return { rest, keypair, message };
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
  const index = loadIndex(root);
  if (index.staged.length === 0) {
    throw new Error("Nothing staged. Run slab add first.");
  }
  saveCommit(root, { message: message.trim(), files: index.staged });
  saveIndex(root, { staged: [] });
  process.stdout.write(
    `[${loadConfig(root).repo}] ${message.trim()} (${index.staged.length} file${index.staged.length === 1 ? "" : "s"})\n`
  );
}

async function cmdPush(keypair?: string) {
  const root = findRoot();
  const config = loadConfig(root);
  const commit = loadCommit(root);
  if (!commit || commit.files.length === 0) {
    throw new Error("Nothing to push. Run slab commit first.");
  }
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
  const { rest, keypair, message } = extractOptions(argv);
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
