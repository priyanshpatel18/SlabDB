export const CLUSTER = "devnet" as const;
export const PROGRAM_ID = "58AARMgjnefMz59oCc4WpnqCmpuR92FfQtNk7mV2Sxet";

/** Base-layer RPC for the wallet adapter. Do not put Helius keys here. */
export const BASE_RPC_URL = "https://rpc.magicblock.app/devnet";

/** MagicBlock public ER router. Do not use https://devnet.magicblock.app/. */
export const ER_ROUTER_URL = "https://devnet-router.magicblock.app/";
export const ER_ROUTER_WS = "wss://devnet-router.magicblock.app/";
export const DEFAULT_ER_URL = "https://devnet-as.magicblock.app/";

export const IRYS_GATEWAY = "https://devnet.irys.xyz";
/** Public Solana devnet. Irys bundler cannot see MagicBlock RPC signatures. */
export const IRYS_RPC_URL = "https://api.devnet.solana.com";
export const NS_LABEL = "default";
/** Wallet homepage and file repos. Separate from the SQL console ns. */
export const HOME_NS = "home";
export const HOME_REPO = "home";
export const README_PATH = "README.md";

export function explorerTxUrl(signature: string) {
  return `https://explorer.solana.com/tx/${signature}?cluster=${CLUSTER}`;
}

export function explorerAddressUrl(address: string) {
  return `https://explorer.solana.com/address/${address}?cluster=${CLUSTER}`;
}

export function shortAddr(address: string, chars = 4) {
  if (address.length <= chars * 2 + 1) return address;
  return `${address.slice(0, chars)}…${address.slice(-chars)}`;
}

export function nsBytes(label = NS_LABEL): number[] {
  const buf = new Uint8Array(32);
  const encoded = new TextEncoder().encode(label);
  buf.set(encoded.subarray(0, 32));
  return Array.from(buf);
}

export function isForbiddenErRpc(url: string): boolean {
  try {
    return new URL(url).hostname === "devnet.magicblock.app";
  } catch {
    return false;
  }
}
