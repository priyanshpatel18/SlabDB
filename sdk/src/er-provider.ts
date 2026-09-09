import { AnchorProvider } from "@anchor-lang/core";
import {
  Transaction,
  VersionedTransaction,
  type ConfirmOptions,
  type Connection,
  type Signer,
  type TransactionSignature,
} from "@solana/web3.js";

function isVersioned(
  tx: Transaction | VersionedTransaction
): tx is VersionedTransaction {
  return "version" in tx;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** ER txs must not use L1 lastValidBlockHeight confirm. Poll processed, then return. */
async function waitProcessed(
  connection: Connection,
  signature: string,
  timeoutMs = 800
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const st = await connection.getSignatureStatus(signature);
    if (st.value?.err) {
      throw new Error(
        `ER tx failed (${signature}): ${JSON.stringify(st.value.err)}`
      );
    }
    if (st.value) {
      return;
    }
    await sleep(40);
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
    const signature = await connection.sendRawTransaction(signed.serialize(), {
      skipPreflight: true,
      maxRetries: 2,
      preflightCommitment: opts?.preflightCommitment ?? "processed",
    });
    await waitProcessed(connection, signature);
    return signature;
  }
}
