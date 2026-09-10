"use client";

import { Keypair } from "@solana/web3.js";
import type { SlabSigner } from "@/lib/wallet";

export function guestSigner(): SlabSigner {
  const kp = Keypair.generate();
  const deny = async () => {
    throw new Error("Sign in to write");
  };
  return {
    publicKey: kp.publicKey,
    signTransaction: deny,
    signAllTransactions: deny,
    signMessage: deny,
  };
}
