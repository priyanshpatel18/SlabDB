# Slab app

Next.js surface for Slab. Landing at `/`. Console at `/console`.

The console uses the connected wallet. Isolation is `[slab, wallet, ns]`. CREATE TABLE and delegate run on base. INSERT, UPDATE, and SELECT run on the public ER after delegate. INSERT packs an 8,192-byte page, uploads it to Irys, waits for the gateway, then sends the receipt id.

Wallet RPC is `https://rpc.magicblock.app/devnet`. Do not put Helius keys in this app. Do not use `https://devnet.magicblock.app/` as validator RPC.

```bash
bun dev
```

Host from this folder (Vercel root `app/` if the git root is `slab/`). Set `NEXT_PUBLIC_SITE_URL` for production metadata.

See the [repo README](../README.md) for the program, client, and tests.
