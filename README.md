# Slab

On-chain SQL catalog for MagicBlock. Pay Arweave once for row pages. Pointers, indexes, and query logic run on an Ephemeral Rollup. Solana L1 only does init, prepare, delegate, and commit.

Product name is **Slab**. SlabDB is informal.

## v0 lock

- Accounts: `Slab`, `Catalog`, `PagePtr`, `Index`. Pointer-per-key is dead.
- SQL: `CREATE TABLE`, `INSERT`, `SELECT`, PK, `WHERE` on one table. No JOIN, UPDATE, BEGIN, COPY.
- Types: bool, int4, int8, text ≤ 1 KiB, timestamptz.
- Tables: 16 in this slice (Solana inner-ix create cap is 10 KiB). 32 after a realloc ix.
- Write-ack: Irys confirm, then write. Local tests use a fixture TXID. Live tests upload the 8 KiB page and wait for the gateway before `INSERT`.
- Public ER before private ER.

## Client

`client/` is a small SQL proxy. It parses Postgres text, packs 8 KiB pages, uploads them (memory store or Irys), and calls the program.

```ts
import { MemoryPageStore, SlabDb } from "./client";

const db = new SlabDb({ program, wallet, ns, store: new MemoryPageStore() });
await db.exec("CREATE TABLE notes (id int8 PRIMARY KEY, author text NOT NULL, body text NOT NULL)");
await db.exec("INSERT INTO notes (id, author, body) VALUES (1, 'ada', 'first note')");
const rows = await db.exec("SELECT * FROM notes WHERE id = 1");
```

`INSERT` writes one row. If the current page is full, the client calls `prepare_page` for the next page. `SELECT` returns decoded rows. `WHERE` on the PK uses the on-chain index. `WHERE` on another column scans pages in the store.

The program never sees SQL text. It receives `SqlStmt`, page pointers, and index keys.

## Routing

| Instruction | Connection |
|---|---|
| `initialize` | Base |
| `prepare_rel` | Base. First-table helper: Index + one PagePtr. Fee vault stays system-owned. |
| `prepare_index` / `prepare_page` | Base. Extra tables and extra pages. Works after Slab is delegated (fee vault stays on L1). |
| `delegate` | Base. First shot: slab + catalog + one Index + one PagePtr. |
| `delegate_index` / `delegate_page` | Base. Extra PDAs after the first delegate. Does not re-delegate Slab or Catalog. |
| `exec_sql` / `exec_insert` | ER after delegate (`skipPreflight: true`). Local tests run these on the validator. |
| `exec_select` | ER (`skipPreflight: true`) |
| `commit` / `undelegate` | ER. Pass extra Index and PagePtr as `remainingAccounts` so MagicIntent commits them. |
| `schedule_commit_crank` | ER (`skipPreflight: true`) |
| `crank_commit` | ER (Magic invokes; no user signer). Uses the delegated Slab as MagicIntent payer plus the validator `magic_fee_vault`. |

## Stack

- Anchor 1.0.2, `ephemeral-rollups-sdk` 0.16.2
- Agave / Solana 3.1.x, SBF platform-tools v1.52
- Bun for TS

## Slices

1. `initialize` + `CREATE TABLE notes` — done. `CREATE TABLE` also inits the PK `Index` PDA.
2. `INSERT` + `SELECT … WHERE` with fixture TXID — done. Row bytes stay off-chain. On-chain: `PagePtr` + PK `Index`. Index cap is 128 keys. A second `INSERT` on the same page updates the pointer. A full page uses `prepare_page` for page 1, 2, …
3. Public ER — this tree. `prepare_*` on L1, delegate, then `CREATE TABLE` and `INSERT` on the public ER. Upload the 8 KiB page to Irys before `INSERT`. Signed `commit` still pushes `catalog_root` to base.
4. Irys write-ack — done. Pack the 8 KiB page, upload, wait for the receipt and gateway bytes, then `INSERT` the Irys id. Row bytes stay off-chain. The public ER suite uses a live Irys id.
5. Commit crank — this tree. Schedule `crank_commit` on the public ER. Magic stamps `catalog_root` and MagicIntent-commits it to base. The crank uses the delegated Slab as payer (see `rewards-delegated-vrf`).
6. SQL client — this tree. `client/` parses the v0 subset, packs typed pages (bool, int4, int8, text, timestamptz), and returns SELECT rows.

## Public ER tests

Default `anchor test` stays on the local validator. Public ER is env-gated.

Deploy once, then run only the ER suite (`RUN_ER_TESTS=1` skips the local validator tests). Copy `.env.example` to `.env` and set `SLAB_BASE_RPC_URL` (Helius devnet). Do not commit `.env`. The payer is `~/.config/solana/id.json`. The suite does not airdrop.

```bash
solana program deploy target/deploy/slab.so \
  --program-id target/deploy/slab-keypair.json \
  --url "$SLAB_BASE_RPC_URL" \
  --use-rpc \
  --with-compute-unit-price 50000

RUN_ER_TESTS=1 \
  anchor test --skip-local-validator --skip-deploy
```

The suite resolves the closest public ER validator. Do not send ER txs to `https://devnet.magicblock.app/` — that alias is not a validator RPC. Do not use `https://api.devnet.solana.com`. `prepare_index` and `prepare_page` pay rent from a system-owned `fee` vault on L1. After delegate, `CREATE TABLE` and `INSERT` only write those PDAs. They do not call System. A second table or a second page is `prepare_*` on L1, then `delegate_index` / `delegate_page`, then `exec_*` on the ER.

## Irys tests

Default `anchor test` does not upload. Live Irys is env-gated. The local validator still runs `INSERT`. Irys funding uses `IRYS_RPC_URL` from `.env` and `~/.config/solana/id.json`.

```bash
RUN_IRYS_TESTS=1 \
  anchor test
```

`INSERT` stores an Irys receipt id in 64 bytes, zero-padded on the right. The program rejects empty or non-ASCII ids. Fetch the page from `https://devnet.irys.xyz/<id>`. `client/store.ts` `IrysPageStore` is the same path for `SlabDb`.

## Commit crank tests

Default `anchor test` does not schedule a crank. Live crank tests are env-gated and need the program on devnet.

```bash
solana program deploy target/deploy/slab.so \
  --program-id target/deploy/slab-keypair.json \
  --url "$SLAB_BASE_RPC_URL" \
  --use-rpc \
  --with-compute-unit-price 100000

RUN_CRANK_TESTS=1 \
  anchor test --skip-local-validator --skip-deploy
```

`schedule_commit_crank` must go to the ER. Magic then runs `crank_commit` (no user signer), stamps `catalog_root` on the ER, and MagicIntent-commits it to base. The crank payer is the delegated Slab, not the wallet.
