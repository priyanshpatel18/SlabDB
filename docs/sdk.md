# SDK

The public client is [`slabdb` on npm](https://www.npmjs.com/package/slabdb). The website console uses the same package. Other apps can talk to the program without the console UI.

## Install

```bash
bun add slabdb
```

Pin `@solana/web3.js` to `1.98.4`. Keep `@anchor-lang/core` at `1.0.2`.

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

After `CREATE TABLE` on base, delegate. Pass `programEr` for `INSERT`, `UPDATE`, and `SELECT` on the public ER.

## Node Irys store

Durable pages on Irys need the Node entry. It uses `fs` for the Solana keypair.

```ts
import { IrysPageStore } from "slabdb/node";

const store = new IrysPageStore();
```

Browser apps should keep 8 KiB pages in the tab until they upload.

## Source

The SDK lives in `sdk/` of [SlabDB](https://github.com/priyanshpatel18/SlabDB).
