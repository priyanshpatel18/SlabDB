import {
  Transaction,
  VersionedTransaction,
  type PublicKey,
} from "@solana/web3.js";

export type SlabTx = Transaction | VersionedTransaction;

export type SlabSigner = {
  publicKey: PublicKey;
  signTransaction: <T extends SlabTx>(tx: T) => Promise<T>;
  signAllTransactions: <T extends SlabTx>(txs: T[]) => Promise<T[]>;
  signMessage: (message: Uint8Array) => Promise<Uint8Array>;
};

export type SlabWallet = {
  ready: boolean;
  connected: boolean;
  connecting: boolean;
  authenticated: boolean;
  publicKey: PublicKey | null;
  address: string | null;
  walletId: string | null;
  agentEnabled: boolean;
  agentAvailable: boolean;
  login: () => void;
  logout: () => Promise<void>;
  enableAgent: () => Promise<void>;
  signTransaction: SlabSigner["signTransaction"];
  signAllTransactions: SlabSigner["signAllTransactions"];
  signMessage: SlabSigner["signMessage"];
};

// True while Privy is restoring a session. Do not render signed-out chrome.
export function isSessionPending(wallet: SlabWallet): boolean {
  return !wallet.ready || (wallet.authenticated && !wallet.connected);
}

// True only after Privy has settled and there is no session.
export function isSignedOut(wallet: SlabWallet): boolean {
  return wallet.ready && !wallet.connected && !wallet.authenticated;
}

export function isVersionedTx(tx: SlabTx): tx is VersionedTransaction {
  return "version" in tx;
}

export function serializeUnsigned(tx: SlabTx): Uint8Array {
  if (isVersionedTx(tx)) {
    return tx.serialize();
  }
  return tx.serialize({
    requireAllSignatures: false,
    verifySignatures: false,
  });
}

export function restoreSigned<T extends SlabTx>(
  original: T,
  signed: Uint8Array
): T {
  if (isVersionedTx(original)) {
    return VersionedTransaction.deserialize(signed) as T;
  }
  return Transaction.from(signed) as T;
}
