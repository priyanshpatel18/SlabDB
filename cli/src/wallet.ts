import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import {
  Keypair,
  Transaction,
  VersionedTransaction,
} from "@solana/web3.js";
import type { SlabWallet } from "slabdb";

export type CliWallet = SlabWallet & { keypair: Keypair };

export function keypairPath(explicit?: string): string {
  return (
    explicit ||
    process.env.ANCHOR_WALLET ||
    join(homedir(), ".config/solana/id.json")
  );
}

export function loadWallet(explicit?: string): CliWallet {
  const path = keypairPath(explicit);
  let parsed: number[];
  try {
    parsed = JSON.parse(readFileSync(path, "utf8")) as number[];
  } catch {
    throw new Error(`Could not read keypair at ${path}`);
  }
  const keypair = Keypair.fromSecretKey(Uint8Array.from(parsed));
  return {
    publicKey: keypair.publicKey,
    keypair,
    async signTransaction<T extends Transaction | VersionedTransaction>(tx: T) {
      if (tx instanceof VersionedTransaction) {
        tx.sign([keypair]);
        return tx;
      }
      tx.partialSign(keypair);
      return tx;
    },
  };
}
