import {
  ConnectionMagicRouter,
  DELEGATION_PROGRAM_ID,
  MAGIC_CONTEXT_ID,
  MAGIC_PROGRAM_ID,
} from "@magicblock-labs/ephemeral-rollups-sdk";
import {
  ComputeBudgetProgram,
  Connection,
  Keypair,
  PublicKey,
  SendTransactionError,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import { DEFAULT_DEVNET_RPC, sleep } from "./helpers";

export const LOCAL_VALIDATOR = new PublicKey(
  "mAGicPQYBMvcYveUZA5F5UNNwyHvfYh5xkLS2Fr1mev"
);
export const DEFAULT_ROUTER = "https://devnet-router.magicblock.app/";
export const DEFAULT_ER = "https://devnet-as.magicblock.app/";

export type Remaining = {
  pubkey: PublicKey;
  isSigner: boolean;
  isWritable: boolean;
};

export function requireBaseRpc(): string {
  const url =
    process.env.SLAB_BASE_RPC_URL ||
    process.env.PROVIDER_ENDPOINT ||
    DEFAULT_DEVNET_RPC;
  let host = "";
  try {
    host = new URL(url).hostname;
  } catch {
    throw new Error(`Invalid SLAB_BASE_RPC_URL: ${url}`);
  }
  if (host === "api.devnet.solana.com") {
    throw new Error(
      `Do not use https://api.devnet.solana.com — it rate-limits writes. Use ${DEFAULT_DEVNET_RPC}`
    );
  }
  return url;
}

export async function requireFundedWallet(
  connection: Connection,
  pubkey: PublicKey,
  label: string
) {
  const lamports = await connection.getBalance(pubkey);
  if (lamports === 0) {
    throw new Error(
      `${label} wallet ${pubkey.toBase58()} has 0 lamports. Use ~/.config/solana/id.json (already funded). This suite does not airdrop.`
    );
  }
}

function isLocalEndpoint(url: string): boolean {
  return url.includes("localhost") || url.includes("127.0.0.1");
}

function isGenericErAlias(url: string): boolean {
  try {
    return new URL(url).hostname === "devnet.magicblock.app";
  } catch {
    return false;
  }
}

export async function sendTx(
  connection: Connection,
  tx: Transaction,
  payer: Keypair,
  label: string,
  opts?: { cuLimit?: number }
): Promise<string> {
  if (opts?.cuLimit) {
    tx.instructions.unshift(
      ComputeBudgetProgram.setComputeUnitLimit({ units: opts.cuLimit })
    );
  }
  tx.feePayer = payer.publicKey;
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  try {
    return await sendAndConfirmTransaction(connection, tx, [payer], {
      skipPreflight: true,
      commitment: "confirmed",
    });
  } catch (err: unknown) {
    let extra = String(err);
    if (err instanceof SendTransactionError) {
      const logs = await err.getLogs(connection).catch(() => []);
      extra = `${err.message}\n${(logs ?? []).join("\n")}`;
    }
    throw new Error(`${label} failed: ${extra}`);
  }
}

export async function waitDelegated(
  connection: Connection,
  pubkey: PublicKey,
  label: string
) {
  for (let i = 0; i < 30; i++) {
    const info = await connection.getAccountInfo(pubkey);
    if (info && info.owner.equals(DELEGATION_PROGRAM_ID)) {
      return;
    }
    await sleep(500);
  }
  throw new Error(
    `${label} ${pubkey.toBase58()} is not owned by the delegation program`
  );
}

export async function waitUndelegated(
  connection: Connection,
  pubkey: PublicKey,
  label: string,
  programId: PublicKey
) {
  for (let i = 0; i < 40; i++) {
    const info = await connection.getAccountInfo(pubkey);
    if (info && info.owner.equals(programId)) {
      return;
    }
    await sleep(500);
  }
  throw new Error(
    `${label} ${pubkey.toBase58()} is still not owned by the program`
  );
}

export async function resolveErTarget(): Promise<{
  erUrl: string;
  remainingAccounts: Remaining[];
}> {
  if (process.env.VALIDATOR && process.env.EPHEMERAL_PROVIDER_ENDPOINT) {
    return {
      erUrl: process.env.EPHEMERAL_PROVIDER_ENDPOINT,
      remainingAccounts: [
        {
          pubkey: new PublicKey(process.env.VALIDATOR),
          isSigner: false,
          isWritable: false,
        },
      ],
    };
  }

  const erEnv = process.env.EPHEMERAL_PROVIDER_ENDPOINT;
  if (erEnv && isLocalEndpoint(erEnv)) {
    return {
      erUrl: erEnv,
      remainingAccounts: [
        { pubkey: LOCAL_VALIDATOR, isSigner: false, isWritable: false },
      ],
    };
  }

  const router = new ConnectionMagicRouter(
    process.env.ROUTER_ENDPOINT || DEFAULT_ROUTER,
    {
      wsEndpoint: process.env.WS_ROUTER_ENDPOINT || "wss://devnet-router.magicblock.app/",
      commitment: "confirmed",
    }
  );
  const closest = await router.getClosestValidator();
  if (!closest.identity) {
    throw new Error(
      "ConnectionMagicRouter.getClosestValidator returned no identity"
    );
  }
  const erUrl =
    closest.fqdn ||
    (erEnv && !isGenericErAlias(erEnv) ? erEnv : DEFAULT_ER);
  return {
    erUrl,
    remainingAccounts: [
      {
        pubkey: new PublicKey(closest.identity),
        isSigner: false,
        isWritable: false,
      },
    ],
  };
}

export function delegationRecordPda(delegated: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("delegation"), delegated.toBuffer()],
    DELEGATION_PROGRAM_ID
  )[0];
}

export function magicFeeVaultPda(validator: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("magic-fee-vault"), validator.toBuffer()],
    DELEGATION_PROGRAM_ID
  )[0];
}

export async function resolveMagicFeeVault(
  connection: Connection,
  delegated: PublicKey
): Promise<{ record: PublicKey; vault: PublicKey; validator: PublicKey }> {
  const record = delegationRecordPda(delegated);
  const info = await connection.getAccountInfo(record, "confirmed");
  if (!info || info.data.length < 40) {
    throw new Error(
      `delegation record missing for ${delegated.toBase58()} — delegate first`
    );
  }
  const validator = new PublicKey(info.data.subarray(8, 40));
  return { record, vault: magicFeeVaultPda(validator), validator };
}

export { MAGIC_CONTEXT_ID, MAGIC_PROGRAM_ID };
