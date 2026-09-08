import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@solana/wallet-adapter-base",
    "@solana/wallet-adapter-react",
    "@solana/wallet-adapter-phantom",
    "@solana/wallet-adapter-solflare",
    "@solana-mobile/wallet-adapter-mobile",
  ],
};

export default nextConfig;
