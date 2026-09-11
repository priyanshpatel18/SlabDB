import { describe, expect, mock, test } from "bun:test";
import { PublicKey } from "@solana/web3.js";

const SIGNATURE = Buffer.alloc(64, 7);

const signMessage = mock(
  async (_walletId: string, opts: { message: Uint8Array }) => {
    expect(opts.message).toEqual(Uint8Array.from([1, 2, 3]));
    return {
      encoding: "base64" as const,
      signature: SIGNATURE.toString("base64"),
    };
  }
);

mock.module("@/lib/privy-server", () => ({
  authorizationKey: () => "test-auth-key",
  privyServer: () => ({
    wallets: () => ({
      solana: () => ({
        signMessage,
        signTransaction: async () => ({
          signed_transaction: Buffer.alloc(64).toString("base64"),
        }),
      }),
    }),
  }),
}));

const { privySlabWallet } = await import("@/lib/privy-slab-wallet");

describe("privySlabWallet", () => {
  test("exposes signMessage for Irys uploads", async () => {
    const wallet = privySlabWallet(
      "wallet_ada",
      "11111111111111111111111111111111"
    );
    expect(wallet.publicKey).toEqual(
      new PublicKey("11111111111111111111111111111111")
    );
    expect(typeof wallet.signMessage).toBe("function");
    const signed = await wallet.signMessage!(Uint8Array.from([1, 2, 3]));
    expect(signed).toEqual(Uint8Array.from(SIGNATURE));
    expect(signMessage).toHaveBeenCalled();
  });
});
