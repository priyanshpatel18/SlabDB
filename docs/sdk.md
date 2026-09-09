# SDK

The public client is [`slabdb` on npm](https://www.npmjs.com/package/slabdb). The website console uses the same package. Other apps can talk to the program without the console UI.

## Install

```bash
bun add slabdb
```

Pin `@solana/web3.js` to `1.98.4`. Keep `@anchor-lang/core` at `1.0.2`.

## Quick start

Browser:

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

Node:

```ts
import { Slab } from "slabdb/node";

const db = await Slab.connect({ wallet, ns: "default" });
```

`connect` builds both programs, picks RPCs, initializes, waits for delegate after the first table, and routes `CREATE` vs `INSERT`.

## Shared catalog

```ts
await owner.grant(playerPubkey);
const player = await Slab.connect({
  wallet: playerWallet,
  ns: "game",
  owner: authority.publicKey,
});
```

The owner can also run `GRANT <pubkey>` and `REVOKE <pubkey>` through `db.exec`.

## Recovery

SHA-256 page pointers from the old in-tab store cannot be fetched. Catch `UnreadablePageError` or call `db.resetTable("users")`, then `INSERT` again.

## Source

The SDK lives in `sdk/` of [SlabDB](https://github.com/priyanshpatel18/SlabDB).
