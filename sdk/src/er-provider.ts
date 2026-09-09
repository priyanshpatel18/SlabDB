import { AnchorProvider } from "@anchor-lang/core";
import {
  SendTransactionError,
  Transaction,
  VersionedTransaction,
  type ConfirmOptions,
  type Connection,
  type Signer,
  type TransactionSignature,
} from "@solana/web3.js";
import { formatProgramError } from "./tx-error";

function isVersioned(
  tx: Transaction | VersionedTransaction
): tx is VersionedTransaction {
  return "version" in tx;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function failErTx(
  connection: Connection,
  signature: string,
  err: unknown
): Promise<never> {
  const tx = await connection
    .getTransaction(signature, {
      maxSupportedTransactionVersion: 0,
      commitment: "confirmed",
    })
    .catch(() => null);
  throw new Error(
    formatProgramError({
      message: `ER tx failed (${signature}): ${JSON.stringify(err)}`,
      logs: tx?.meta?.logMessages ?? [],
      error: err,
    })
  );
}

/** ER txs must not use L1 lastValidBlockHeight confirm. Poll processed, then return. */
async function waitProcessed(
  connection: Connection,
  signature: string,
  timeoutMs = 4000
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const st = await connection.getSignatureStatus(signature);
    if (st.value?.err) {
      await failErTx(connection, signature, st.value.err);
    }
    if (st.value) {
      return;
    }
    await sleep(40);
  }
  const late = await connection.getSignatureStatus(signature);
  if (late.value?.err) {
    await failErTx(connection, signature, late.value.err);
  }
  const tx = await connection
    .getTransaction(signature, {
      maxSupportedTransactionVersion: 0,
      commitment: "confirmed",
    })
    .catch(() => null);
  if (tx?.meta?.err) {
    throw new Error(
      formatProgramError({
        message: `ER tx failed (${signature}): ${JSON.stringify(tx.meta.err)}`,
        logs: tx.meta.logMessages ?? [],
        error: tx.meta.err,
      })
    );
  }
}

/**
 * Sign, send raw to the ER, skip preflight. Do not confirm on base Solana.
 */
export class ErProvider extends AnchorProvider {
  async sendAndConfirm(
    tx: Transaction | VersionedTransaction,
    signers?: Signer[],
    opts?: ConfirmOptions
  ): Promise<TransactionSignature> {
    const connection = this.connection;
    const latest = await connection.getLatestBlockhash("processed");
    if (isVersioned(tx)) {
      if (signers) {
        tx.sign(signers);
      }
    } else {
      tx.feePayer = tx.feePayer ?? this.wallet.publicKey;
      tx.recentBlockhash = latest.blockhash;
      tx.lastValidBlockHeight = latest.lastValidBlockHeight;
      if (signers) {
        for (const signer of signers) {
          tx.partialSign(signer);
        }
      }
    }
    const signed = await this.wallet.signTransaction(tx);
    let signature: TransactionSignature;
    try {
      signature = await connection.sendRawTransaction(signed.serialize(), {
        skipPreflight: true,
        maxRetries: 2,
        preflightCommitment: opts?.preflightCommitment ?? "processed",
      });
    } catch (err) {
      let logs: string[] = [];
      if (err instanceof SendTransactionError) {
        logs = (await err.getLogs(connection).catch(() => [])) ?? [];
      }
      throw new Error(formatProgramError({ message: String(err), logs, cause: err }));
    }
    await waitProcessed(connection, signature);
    return signature;
  }
}
