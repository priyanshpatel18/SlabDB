# slabdb

TypeScript SDK for the Slab protocol. Slab is a SQL catalog on a MagicBlock public Ephemeral Rollup. Table pages are 8,192 bytes on Irys. Pointers, indexes, and query logic run on the rollup.

The website console in `app/` is one consumer of this package. Other apps can use the same connection and SQL path without that UI.

## Install

```bash
bun add slabdb @solana/web3.js @anchor-lang/core
```

Until this package is on npm, use the repo path:

```bash
bun add github:priyanshpatel18/SlabDB#main:sdk
```

Or in this repo: `"slabdb": "file:../sdk"`.

## Quick start

```ts
import { AnchorProvider, Program } from "@anchor-lang/core";
import { MemoryPageStore, SlabDb, SLAB_PROGRAM_ID } from "slabdb";
import idl from "slabdb/idl/slab.json";

const db = new SlabDb({
  program: new Program(idl, provider),
  wallet: provider.wallet.publicKey,
  ns: new Array(32).fill(0),
  store: new MemoryPageStore(),
});

await db.exec(
  "CREATE TABLE notes (id int8 PRIMARY KEY, author text NOT NULL, body text NOT NULL)",
);
await db.exec(
  "INSERT INTO notes (id, author, body) VALUES (1, 'ada', 'first note')",
);
const rows = await db.exec("SELECT * FROM notes WHERE id = 1");
```

After `CREATE TABLE` on base, delegate. Then `INSERT`, `UPDATE`, and `SELECT` go to the public ER. Pass `programEr` for the rollup program.

## Node Irys store

Durable pages on Irys need the Node entry (uses `fs` for the Solana keypair):

```ts
import { IrysPageStore } from "slabdb/node";

const store = new IrysPageStore();
```

Browser apps should keep 8 KiB pages in session storage (see `app/lib/irys-store.ts`) until they upload.

## v0 SQL

`CREATE TABLE`, `INSERT`, `SELECT`, `UPDATE`, `DELETE`, `DROP TABLE`, `CREATE INDEX`.

Types: bool, int4, int8, text (max 1 KiB), timestamptz. A PRIMARY KEY is required. No JOIN.

## Defaults

| Name | Value |
| --- | --- |
| Program | `58AARMgjnefMz59oCc4WpnqCmpuR92FfQtNk7mV2Sxet` |
| Base RPC | `https://rpc.magicblock.app/devnet` |
| ER router | `https://devnet-router.magicblock.app/` |

Do not send ER transactions to `https://devnet.magicblock.app/`.
