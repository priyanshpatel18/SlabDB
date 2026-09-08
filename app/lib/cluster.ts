export const CLUSTER = "devnet" as const;
export const PROGRAM_ID = "58AARMgjnefMz59oCc4WpnqCmpuR92FfQtNk7mV2Sxet";

/** Base-layer RPC for wallet connection. Do not use the ER validator URL here. */
export const BASE_RPC_URL = "https://rpc.magicblock.app/devnet";

export function explorerAddressUrl(address: string) {
  return `https://explorer.solana.com/address/${address}?cluster=${CLUSTER}`;
}

export function shortAddr(address: string, chars = 4) {
  if (address.length <= chars * 2 + 1) return address;
  return `${address.slice(0, chars)}…${address.slice(-chars)}`;
}
