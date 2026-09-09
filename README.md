# Slab

SQL catalog on a MagicBlock public Ephemeral Rollup. Table pages are 8,192 bytes on Irys. Pointers, indexes, and query logic run on the rollup. Solana L1 only does init, prepare, delegate, and commit.

Program: [`58AARMgjnefMz59oCc4WpnqCmpuR92FfQtNk7mV2Sxet`](https://explorer.solana.com/address/58AARMgjnefMz59oCc4WpnqCmpuR92FfQtNk7mV2Sxet?cluster=devnet)

## App

Landing and `/console` live in `app/`. Sign in with Privy (email or Google). Slab always uses the Privy Solana embedded wallet. External wallets are off. CREATE TABLE and delegate run on base. INSERT packs an 8 KiB page in the tab, then sends `execInsert` to the public ER (`skipPreflight`, processed). Do not confirm that tx on L1. After you enable the agent signer, INSERT is signed by the app authorization key (dual signer) with no wallet popup.

```bash
cd app && bun dev
```

Open [http://localhost:3000](http://localhost:3000). Docs are at `/docs`. Host `app/` on Vercel (Root Directory `app/`). The console depends on npm `slabdb`. Do not put Helius keys in the Next.js client. Wallet RPC is `https://rpc.magicblock.app/devnet`.

## Privy

Set `NEXT_PUBLIC_PRIVY_APP_ID` in `app/.env.local`. In the Privy Dashboard:

1. Login methods: email and Google. Do not enable wallet login.
2. Embedded wallets: Solana create on login for all users. Ethereum off.
3. Authorization keys: register a P-256 key quorum. Put the quorum id in `NEXT_PUBLIC_PRIVY_SIGNER_ID`. Put the private key in `PRIVY_AUTHORIZATION_KEY`. Put the app secret in `PRIVY_APP_SECRET`.
4. Enable signers / server-side access for the app.

The user owns the embedded wallet. **Enable agent** adds the key quorum as a second signer. After that, SQL writes sign through `/api/agent/sign` and send to the ER.

## v0 SQL

`CREATE TABLE`, `INSERT`, `SELECT`, `UPDATE`, `DELETE`, `DROP TABLE`, `CREATE INDEX`. PK `WHERE`. Secondary index `WHERE` after `CREATE INDEX` (no backfill). No JOIN, BEGIN, or COPY.

Types: bool, int4, int8, text ≤ 1 KiB, timestamptz.

Accounts: `Slab`, `Catalog`, `PagePtr`, `Index`. Init creates 16 table slots. `realloc_catalog` on L1 grows the catalog to 32. Do that before delegate.

Console write-ack: Irys receipt id in the PagePtr. INSERT uploads the 8 KiB page and waits for the gateway so other wallets can SELECT. Local tests may use a fixture TXID. Fund Irys if the bundler has no balance.

## SDK

`sdk/` is the public TypeScript client (`slabdb`). The console in `app/` uses it. Other apps can use the same package to talk to the program without the website UI.

```ts
import { MemoryPageStore, SlabDb } from "slabdb";

const db = new SlabDb({ program, wallet, ns, store: new MemoryPageStore() });
await db.exec(
  "CREATE TABLE notes (id int8 PRIMARY KEY, author text NOT NULL, body text NOT NULL)",
);
await db.exec("INSERT INTO notes (id, author, body) VALUES (1, 'ada', 'first note')");
const rows = await db.exec("SELECT * FROM notes WHERE id = 1");
```

See `sdk/README.md`. The console depends on npm `slabdb`. Change the protocol client in `sdk/`, publish a new version, then bump the version in `app/package.json`.

`INSERT` writes one row. A full page calls `prepare_page` for the next page. PK `WHERE` uses the on-chain index. `CREATE INDEX` then `WHERE col =` uses a secondary `Index` PDA. Other `WHERE` clauses scan pages in the store. `UPDATE` / `DELETE` rewrite the Irys page, then update the pointer and index. `DROP TABLE` frees the catalog slot. Oids are not reused.

`CREATE TABLE` stays on L1. After delegate, `INSERT` / `UPDATE` / `SELECT` go to the ER with `programEr` and a session page store.

## Routing

| Instruction | Connection |
| --- | --- |
| `initialize` | Base |
| `prepare_rel` | Base. First table: Index + one PagePtr. Fee vault stays system-owned. |
| `prepare_index` / `prepare_page` | Base. Extra tables and pages. Works after Slab is delegated. |
| `delegate` | Base. First shot: slab + catalog + one Index + one PagePtr. |
| `delegate_index` / `delegate_page` | Base. Extra PDAs. Does not re-delegate Slab or Catalog. |
| `realloc_catalog` | Base, before delegate. |
| `exec_sql` / `exec_insert` / `exec_mutate` / `exec_index_put` | ER after delegate (`skipPreflight: true`). |
| `exec_select` | ER. After undelegate, send this to base. |
| `exec_drop` / `exec_create_index` | ER after delegate. |
| `commit` / `undelegate` | ER. Extra Index and PagePtr as `remainingAccounts`. |
| `schedule_commit_crank` | ER (`skipPreflight: true`). |
| `crank_commit` | ER. Magic invokes. No user signer. Payer is the delegated Slab. |

Do not send ER txs to `https://devnet.magicblock.app/`. That alias is not a validator RPC. Do not use `https://api.devnet.solana.com` for this suite.

## Stack

- Anchor 1.0.2, `ephemeral-rollups-sdk` 0.16.2
- Agave / Solana 3.1.x, SBF platform-tools v1.52
- Bun for TypeScript

## Tests

Copy `.env.example` to `.env`. Set `SLAB_BASE_RPC_URL`. Do not commit `.env`. The payer is `~/.config/solana/id.json`. The suite does not airdrop.

Default `anchor test` stays on the local validator. Public ER, live Irys, and the commit crank are env-gated.

```bash
solana program deploy target/deploy/slab.so \
  --program-id target/deploy/slab-keypair.json \
  --url "$SLAB_BASE_RPC_URL" \
  --use-rpc \
  --with-compute-unit-price 50000

RUN_ER_TESTS=1 \
  anchor test --skip-local-validator --skip-deploy
```

```bash
RUN_IRYS_TESTS=1 \
  anchor test
```

```bash
RUN_CRANK_TESTS=1 \
  anchor test --skip-local-validator --skip-deploy
```

`INSERT` stores an Irys receipt id in 64 bytes, zero-padded on the right. Fetch the page from `https://devnet.irys.xyz/<id>`.
