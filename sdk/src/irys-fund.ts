import {
  ComputeBudgetProgram,
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";

const FUND_TX_RE =
  /failed to post funding tx - ([1-9A-HJ-NP-Za-km-z]{32,88})/;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type IrysFunder = {
  token?: string;
  utils: {
    toAtomic: (n: number) => { toString: () => string };
    getBundlerAddress: (token?: string) => Promise<string>;
  };
  getPrice: (n: number) => Promise<{ toString: () => string }>;
  getLoadedBalance: () => Promise<{ toString: () => string }>;
  fund: (amount: string, multiplier?: number) => Promise<unknown>;
  funder: { submitFundTransaction: (id: string) => Promise<unknown> };
  upload: (
    data: Buffer,
    opts: { tags: { name: string; value: string }[] }
  ) => Promise<{ id?: string }>;
};

export type FundWallet = {
  publicKey: PublicKey;
  signTransaction: (tx: Transaction) => Promise<Transaction>;
};

export type StatusFn = (msg: string) => void;

export function fundTxIdFromError(err: unknown): string | null {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    FUND_TX_RE.exec(msg)?.[1] ??
    /\(([1-9A-HJ-NP-Za-km-z]{32,88})\)/.exec(msg)?.[1] ??
    null
  );
}

async function signatureStatus(
  rpcUrl: string,
  txid: string
): Promise<"processed" | "confirmed" | "finalized" | "failed" | null> {
  const connection = new Connection(rpcUrl, "confirmed");
  const st = await connection.getSignatureStatus(txid, {
    searchTransactionHistory: true,
  });
  if (st.value?.err) {
    return "failed";
  }
  return st.value?.confirmationStatus ?? null;
}

/** Keep posting the SOL tx id to Irys until the bundler indexes it. */
export async function creditIrysFund(
  irys: IrysFunder,
  txid: string,
  onStatus: StatusFn = () => {},
  timeoutMs = 45_000
): Promise<void> {
  const start = Date.now();
  let lastErr: unknown;
  let n = 0;
  while (Date.now() - start < timeoutMs) {
    n += 1;
    onStatus(`Crediting Irys bundler (${n})`);
    try {
      await irys.funder.submitFundTransaction(txid);
      return;
    } catch (err) {
      lastErr = err;
      await sleep(1_000);
    }
  }
  throw lastErr instanceof Error
    ? lastErr
    : new Error(`Irys bundler did not credit ${txid}`);
}

export async function sendIrysFund(opts: {
  irys: IrysFunder;
  wallet: FundWallet;
  rpcUrl: string;
  pendingTxid?: string | null;
  onStatus?: StatusFn;
  onSent?: (sig: string) => void;
}): Promise<void> {
  const { irys, wallet, rpcUrl, onStatus = () => {}, onSent } = opts;
  const price = await irys.getPrice(8192);
  const loaded = await irys.getLoadedBalance();
  if (BigInt(loaded.toString()) >= BigInt(price.toString())) {
    onStatus("Irys already funded");
    return;
  }

  if (opts.pendingTxid) {
    const st = await signatureStatus(rpcUrl, opts.pendingTxid);
    if (st === "failed") {
      onStatus("Previous fund tx failed. Sending a new one.");
    } else if (st) {
      try {
        await creditIrysFund(irys, opts.pendingTxid, onStatus, 20_000);
        return;
      } catch {
        onStatus("Previous fund tx was not credited. Sending a new one.");
      }
    }
  }

  const to = await irys.utils.getBundlerAddress(irys.token ?? "solana");
  const connection = new Connection(rpcUrl, {
    commitment: "confirmed",
    confirmTransactionInitialTimeout: 20_000,
  });
  const lamports = Number(irys.utils.toAtomic(0.05).toString());
  onStatus("Approve Irys fund in wallet");
  const latest = await connection.getLatestBlockhash("confirmed");
  const tx = new Transaction({
    feePayer: wallet.publicKey,
    blockhash: latest.blockhash,
    lastValidBlockHeight: latest.lastValidBlockHeight,
  });
  tx.add(
    SystemProgram.transfer({
      fromPubkey: wallet.publicKey,
      toPubkey: new PublicKey(to),
      lamports,
    })
  );
  tx.add(
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1_000_000 })
  );
  tx.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 20_000 }));

  const signed = await wallet.signTransaction(tx);
  const sig = await connection.sendRawTransaction(signed.serialize(), {
    skipPreflight: false,
    preflightCommitment: "confirmed",
  });
  onSent?.(sig);
  onStatus("Waiting for Solana confirm");
  const conf = await connection.confirmTransaction(
    {
      signature: sig,
      blockhash: latest.blockhash,
      lastValidBlockHeight: latest.lastValidBlockHeight,
      abortSignal: AbortSignal.timeout(20_000),
    },
    "confirmed"
  );
  if (conf.value.err) {
    throw new Error(`Irys fund tx failed on Solana (${sig})`);
  }
  await creditIrysFund(irys, sig, onStatus);
}
