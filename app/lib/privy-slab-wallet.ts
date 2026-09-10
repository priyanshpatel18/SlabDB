import {
  PublicKey,
  Transaction,
  VersionedTransaction,
} from "@solana/web3.js";
import type { SlabWallet } from "slabdb";
import { authorizationKey, privyServer } from "@/lib/privy-server";
import { restoreSigned, serializeUnsigned } from "@/lib/wallet";

export function privySlabWallet(walletId: string, address: string): SlabWallet {
  const publicKey = new PublicKey(address);
  const privy = privyServer();
  return {
    publicKey,
    async signTransaction<T extends Transaction | VersionedTransaction>(tx: T) {
      const signed = await privy.wallets().solana().signTransaction(walletId, {
        transaction: Buffer.from(serializeUnsigned(tx)).toString("base64"),
        authorization_context: {
          authorization_private_keys: [authorizationKey()],
        },
      });
      return restoreSigned(
        tx,
        Uint8Array.from(Buffer.from(signed.signed_transaction, "base64"))
      );
    },
  };
}
