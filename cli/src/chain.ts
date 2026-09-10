import { PublicKey } from "@solana/web3.js";
import { TEXT_MAX_BYTES, type SlabClient } from "slabdb";
import { Slab } from "slabdb/node";
import {
  FILES_SQL,
  HOME_NS,
  type SlabConfig,
  type StagedFile,
} from "./repo";
import type { CliWallet } from "./wallet";

function log(msg: string) {
  process.stderr.write(`${msg}\n`);
}

export async function openDb(
  wallet: CliWallet,
  config: Pick<SlabConfig, "ns" | "owner">,
  opts: { autoDelegate?: boolean } = {}
): Promise<SlabClient> {
  const owner = config.owner ? new PublicKey(config.owner) : wallet.publicKey;
  log("Opening Slab");
  return Slab.connect({
    wallet,
    ns: config.ns || HOME_NS,
    owner,
    autoDelegate: opts.autoDelegate,
  });
}

export async function listFiles(
  client: SlabClient,
  repo: string
): Promise<StagedFile[]> {
  const rows = await client.exec(`SELECT * FROM ${repo}`);
  return rows
    .map((row) => ({
      path: typeof row.path === "string" ? row.path : "",
      body: typeof row.body === "string" ? row.body : "",
    }))
    .filter((row) => row.path);
}

export async function ensureRepo(client: SlabClient, repo: string) {
  const rels = (await client.db.catalog()).rels;
  if (rels.some((rel) => rel.name === repo)) {
    return;
  }
  log(`CREATE TABLE ${repo}`);
  await client.exec(`CREATE TABLE ${repo} ${FILES_SQL}`);
}

export async function upsertFiles(
  client: SlabClient,
  repo: string,
  files: StagedFile[]
) {
  for (const file of files) {
    const bytes = Buffer.byteLength(file.body, "utf8");
    if (bytes > TEXT_MAX_BYTES) {
      throw new Error(`${file.path} is ${bytes} bytes. Max is ${TEXT_MAX_BYTES}`);
    }
    log(`Writing ${file.path}`);
    const rows = await client.exec(`SELECT * FROM ${repo} WHERE path = $1`, [
      file.path,
    ]);
    if (rows[0]) {
      await client.exec(`UPDATE ${repo} SET body = $1 WHERE path = $2`, [
        file.body,
        file.path,
      ]);
    } else {
      await client.exec(`INSERT INTO ${repo} (path, body) VALUES ($1, $2)`, [
        file.path,
        file.body,
      ]);
    }
  }
}
