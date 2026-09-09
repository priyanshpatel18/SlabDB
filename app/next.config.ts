import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnvConfig } from "@next/env";
import type { NextConfig } from "next";

const appDir = path.dirname(fileURLToPath(import.meta.url));
const slabRoot = path.resolve(appDir, "..");

loadEnvConfig(slabRoot);
loadEnvConfig(appDir);

const nextConfig: NextConfig = {
  outputFileTracingRoot: slabRoot,
  turbopack: {
    root: slabRoot,
    resolveAlias: {
      "@/client": path.join(slabRoot, "client"),
    },
  },
  transpilePackages: [
    "@privy-io/react-auth",
    "@privy-io/node",
    "@anchor-lang/core",
    "@magicblock-labs/ephemeral-rollups-sdk",
    "@irys/web-upload",
    "@irys/web-upload-solana",
    "@noble/hashes",
    "@solana/web3.js",
    "pgsql-ast-parser",
  ],
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "@/client": path.join(slabRoot, "client"),
    };
    config.resolve.modules = [
      path.join(appDir, "node_modules"),
      path.join(slabRoot, "node_modules"),
      ...(Array.isArray(config.resolve.modules)
        ? config.resolve.modules
        : ["node_modules"]),
    ];
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
