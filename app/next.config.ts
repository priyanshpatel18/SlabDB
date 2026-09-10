import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const appDir = path.dirname(fileURLToPath(import.meta.url));
const slabRoot = path.resolve(appDir, "..");

const nextConfig: NextConfig = {
  outputFileTracingRoot: slabRoot,
  outputFileTracingIncludes: {
    "/docs/**": ["../docs/**"],
    "/privacy": ["../docs/privacy.md"],
    "/terms": ["../docs/terms.md"],
    "/refunds": ["../docs/refunds.md"],
    "/cookies": ["../docs/cookies.md"],
  },
  turbopack: {},
  async redirects() {
    return [
      { source: "/docs/privacy", destination: "/privacy", permanent: true },
      { source: "/docs/terms", destination: "/terms", permanent: true },
      { source: "/docs/refunds", destination: "/refunds", permanent: true },
      { source: "/docs/cookies", destination: "/cookies", permanent: true },
    ];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
        ],
      },
    ];
  },
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
