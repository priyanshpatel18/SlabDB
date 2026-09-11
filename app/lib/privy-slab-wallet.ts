import {
  PublicKey,
  Transaction,
  VersionedTransaction,
} from "@solana/web3.js";
import type { SlabWallet } from "slabdb";
import { authorizationKey, privyServer } from "@/lib/privy-server";
import { restoreSigned, serializeUnsigned } from "@/lib/wallet";

function authContext() {
  return {
    authorization_context: {
      authorization_private_keys: [authorizationKey()],
    },
  };
}

export function privySlabWallet(walletId: string, address: string): SlabWallet {
  const publicKey = new PublicKey(address);
  const privy = privyServer();
  const solana = privy.wallets().solana();
  return {
    publicKey,
    async signTransaction<T extends Transaction | VersionedTransaction>(tx: T) {
      const signed = await solana.signTransaction(walletId, {
        transaction: Buffer.from(serializeUnsigned(tx)).toString("base64"),
        ...authContext(),
      });
      return restoreSigned(
        tx,
        Uint8Array.from(Buffer.from(signed.signed_transaction, "base64"))
      );
    },
    async signMessage(message: Uint8Array) {
      const signed = await solana.signMessage(walletId, {
        message,
        ...authContext(),
      });
      return Uint8Array.from(
        Buffer.from(signed.signature, signed.encoding || "base64")
      );
    },
  };
}
