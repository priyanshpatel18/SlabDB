import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const appDir = path.dirname(fileURLToPath(import.meta.url));
const slabRoot = path.resolve(appDir, "..");

const nextConfig: NextConfig = {
  outputFileTracingRoot: slabRoot,
  turbopack: {},
  transpilePackages: [
    "slabdb",
    "@privy-io/react-auth",
    "@privy-io/node",
    "@anchor-lang/core",
    "@magicblock-labs/ephemeral-rollups-sdk",
    "@irys/web-upload",
    "@irys/web-upload-solana",
  ],
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      os: false,
      path: false,
      crypto: false,
      stream: false,
    };
    config.externals = config.externals || {};
    if (typeof config.externals === "object" && !Array.isArray(config.externals)) {
      config.externals["@solana/kit"] = "commonjs @solana/kit";
    }
    return config;
  },
};

export default nextConfig;
