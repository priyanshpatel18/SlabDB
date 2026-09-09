/** On-chain program on Solana devnet. */
export const SLAB_PROGRAM_ID =
  "58AARMgjnefMz59oCc4WpnqCmpuR92FfQtNk7mV2Sxet";

/** Base-layer RPC. Do not put Helius keys here. */
export const DEFAULT_BASE_RPC = "https://rpc.magicblock.app/devnet";

/** MagicBlock public ER router. Do not use https://devnet.magicblock.app/. */
export const DEFAULT_ER_ROUTER = "https://devnet-router.magicblock.app/";
export const DEFAULT_ER_WS = "wss://devnet-router.magicblock.app/";
export const DEFAULT_ER_URL = "https://devnet-as.magicblock.app/";

export const IRYS_GATEWAY = "https://devnet.irys.xyz";
/** Public Solana devnet. Irys bundler cannot see MagicBlock RPC signatures. */
export const IRYS_RPC_URL = "https://api.devnet.solana.com";

export function nsBytes(label: string | number[]): number[] {
  if (Array.isArray(label)) {
    if (label.length !== 32) {
      throw new Error("ns must be 32 bytes");
    }
    return label.map((n) => Number(n));
  }
  const buf = Buffer.alloc(32);
  Buffer.from(label).copy(buf);
  return Array.from(buf);
}
