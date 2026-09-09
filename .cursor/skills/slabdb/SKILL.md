---
name: slabdb
description: >-
  Slab SQL catalog on MagicBlock public Ephemeral Rollups. Use when installing
  or calling slabdb, writing v0 SQL, routing CREATE TABLE to base and
  INSERT/UPDATE/SELECT to the public ER, packing 8 KiB Irys pages, or wiring
  the Slab console. Do not use for private ER, Helius keys, or bumping Anchor.
---

# Slab (`slabdb`)

## What this skill is for

Use this skill when the user asks for:

- The `slabdb` npm SDK
- SQL on Slab (CREATE TABLE, INSERT, SELECT, UPDATE, DELETE, DROP TABLE, CREATE INDEX)
- Public Ephemeral Rollup writes after delegate
- Irys-shaped 8,192-byte pages
- The Slab website console

## Pins

- Program: `58AARMgjnefMz59oCc4WpnqCmpuR92FfQtNk7mV2Sxet`
- `@solana/web3.js`: `1.98.4`
- `@anchor-lang/core`: `1.0.2`
- Base RPC: `https://rpc.magicblock.app/devnet`
- ER router: `https://devnet-router.magicblock.app/`
- Install: `bun add slabdb`

Do not send ER transactions to `https://devnet.magicblock.app/`.
Do not put Helius keys in the client.
Do not bump Anchor or Agave.
Do not start a private ER.

## Connect

```ts
import { Slab } from "slabdb/web"; // browser
// import { Slab } from "slabdb/node"; // Node

const db = await Slab.connect({ wallet, ns: "default" });
await db.exec("INSERT INTO notes (id, author) VALUES ($1, $2)", [1, "ada"]);
```

`connect` initializes, waits for delegate after the first `CREATE TABLE`, and routes `CREATE` to base vs `INSERT` on the public ER.

Shared catalog: `connect({ wallet, ns, owner })` then the owner calls `db.grant(player)`. Isolation is `[slab, owner, ns]`.

Do not import `slabdb/node` in the browser. Do not import `slabdb/web` in Node unless you have `@irys/web-upload`.

## Routing

- CREATE TABLE, initialize, prepare, delegate: base
- INSERT, UPDATE, DELETE, SELECT after delegate: public ER
- ER send: fresh ER blockhash, `signTransaction`, `sendRawTransaction` with `skipPreflight`, poll processed
- Do not confirm ER txs on L1 `lastValidBlockHeight`

## SQL

v0 only. PRIMARY KEY required. No JOIN.

Types: bool, int4, int8, text (max 4 KiB), timestamptz, uuid, float8, json, bytea.

`SELECT` supports `WHERE col =`, `ORDER BY`, `LIMIT`, `OFFSET`. `CREATE INDEX` backfills old rows.

Parameterized SQL: `db.exec(sql, [p1, p2])`.

The program never sees SQL text.

## Recovery

Old SHA-256 page pointers cannot be fetched. Catch `UnreadablePageError` or call `db.resetTable(name)`, then INSERT again.

## Docs

https://slab.priyanshpatel.com/docs
