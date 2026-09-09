# slabdb

TypeScript SDK for the Slab protocol. Slab is a SQL catalog on a MagicBlock public Ephemeral Rollup. Table pages are 8,192 bytes on Irys. Pointers, indexes, and query logic run on the rollup.

The website console in `app/` is one consumer of this package. Other apps can use the same connection and SQL path without that UI.

## Install

```bash
bun add slabdb
```

Also install `@solana/web3.js` and `@anchor-lang/core` if your app does not already have them. Pin `@solana/web3.js` to `1.98.4`.

The website console depends on the published npm package. After you change `sdk/`, publish a new version and bump `slabdb` in `app/package.json`.

## Quick start

Browser (Next.js):

```ts
import { Slab } from "slabdb/web";

const db = await Slab.connect({ wallet, ns: "default" });
await db.exec(
  "CREATE TABLE notes (id int8 PRIMARY KEY, author text NOT NULL, body text NOT NULL)",
);
await db.exec("INSERT INTO notes (id, author, body) VALUES ($1, $2, $3)", [
  1,
  "ada",
  "first note",
]);
const rows = await db.exec("SELECT * FROM notes ORDER BY id LIMIT 10");
```

`connect` initializes the catalog, waits for delegate after the first `CREATE TABLE`, and routes `CREATE` to base and `INSERT` to the public ER.

Node:

```ts
import { Slab } from "slabdb/node";

const db = await Slab.connect({ wallet, ns: "default" });
```

Low-level `SlabDb` is still exported from `slabdb` if you already have two `Program` instances.

## Shared catalog

Isolation is `[slab, owner, ns]`. Pass `owner` so many users share one schema. The owner calls `db.grant(player)` so that player can `INSERT`.

```ts
const app = await Slab.connect({ wallet: authority, ns: "game" });
await app.grant(playerPubkey);

const player = await Slab.connect({
  wallet: playerWallet,
  ns: "game",
  owner: authority.publicKey,
});
await player.exec("INSERT INTO scores (id, pts) VALUES ($1, $2)", [id, 10]);
```

`CREATE TABLE`, `DROP TABLE`, `GRANT`, and delegate stay with the owner.

## v0 SQL

`CREATE TABLE`, `INSERT`, `SELECT`, `UPDATE`, `DELETE`, `DROP TABLE`, `CREATE INDEX`.

Types: bool, int4, int8, text (max 4 KiB), timestamptz, uuid, float8, json, bytea.

`SELECT` supports `WHERE col =`, `ORDER BY`, `LIMIT`, and `OFFSET`. `CREATE INDEX` backfills existing rows.

Parameterized SQL: `db.exec("INSERT ... VALUES ($1, $2)", [id, name])`.

A PRIMARY KEY is required. No JOIN.

## Pages and recovery

INSERT uploads the page to Irys and writes the receipt on-chain. The SDK returns after the ER transaction. Gateway confirm runs in the background.

Old SHA-256 page pointers cannot be fetched. The SDK throws `UnreadablePageError` with `dropSql` and `createSql`. Call `db.resetTable(name)` to `DROP` and `CREATE` the same schema, then `INSERT` again.

## Defaults

| Name | Value |
| --- | --- |
| Program | `58AARMgjnefMz59oCc4WpnqCmpuR92FfQtNk7mV2Sxet` |
| Base RPC | `https://rpc.magicblock.app/devnet` |
| ER router | `https://devnet-router.magicblock.app/` |

Do not send ER transactions to `https://devnet.magicblock.app/`.
