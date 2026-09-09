import { ConnectionMagicRouter } from "@magicblock-labs/ephemeral-rollups-sdk";
import { PublicKey } from "@solana/web3.js";
import type { Remaining } from "slabdb";
import {
  DEFAULT_ER_URL,
  ER_ROUTER_URL,
  ER_ROUTER_WS,
  isForbiddenErRpc,
} from "@/lib/cluster";

export type ErTarget = {
  erUrl: string;
  remainingAccounts: Remaining[];
};

export async function resolveErTarget(): Promise<ErTarget> {
  const router = new ConnectionMagicRouter(ER_ROUTER_URL, {
    wsEndpoint: ER_ROUTER_WS,
    commitment: "confirmed",
  });
  const closest = await router.getClosestValidator();
  if (!closest.identity) {
    throw new Error("ER router returned no validator identity");
  }
  const erUrl = closest.fqdn || DEFAULT_ER_URL;
  if (isForbiddenErRpc(erUrl)) {
    throw new Error(
      "Refusing https://devnet.magicblock.app/ as validator RPC. Use the closest validator FQDN."
    );
  }
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
