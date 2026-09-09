import { ConnectionMagicRouter } from "@magicblock-labs/ephemeral-rollups-sdk";
import { PublicKey } from "@solana/web3.js";
import {
  DEFAULT_ER_ROUTER,
  DEFAULT_ER_URL,
  DEFAULT_ER_WS,
} from "./config";
import type { Remaining } from "./db";

export type ErTarget = {
  erUrl: string;
  remainingAccounts: Remaining[];
};

function isForbiddenErRpc(url: string): boolean {
  try {
    return new URL(url).hostname === "devnet.magicblock.app";
  } catch {
    return false;
  }
}

export async function resolveErTarget(opts?: {
  router?: string;
  ws?: string;
}): Promise<ErTarget> {
  const routerUrl = opts?.router ?? DEFAULT_ER_ROUTER;
  const router = new ConnectionMagicRouter(routerUrl, {
    wsEndpoint: opts?.ws ?? DEFAULT_ER_WS,
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
