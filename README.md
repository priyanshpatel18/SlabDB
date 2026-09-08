# Slab

On-chain SQL catalog for MagicBlock. Pay Arweave once for row pages. Pointers, indexes, and query logic run on a Private Ephemeral Rollup. Solana L1 only does init, delegate, and commit.

Product name is **Slab**. SlabDB is informal.

## v0 lock

- Accounts: `Slab`, `Catalog`, `PagePtr`, `Index`. Pointer-per-key is dead.
- SQL: `CREATE TABLE`, `INSERT`, `SELECT`, PK, `WHERE` on one table. No JOIN, UPDATE, BEGIN, COPY.
- Types: bool, int4, int8, text ≤ 1 KiB, timestamptz.
- Tables: 16 in this slice (Solana inner-ix create cap is 10 KiB). 32 after a realloc ix.
- Write-ack: Irys confirm, then write. Local tests use a fixture TXID. Live tests upload the 8 KiB page and wait for the gateway before `INSERT`.
- Public ER before private ER.

## Routing

| Instruction | Connection |
|---|---|
| `initialize` | Base |
| `prepare_rel` | Base (creates empty Index + PagePtr while the fee vault is system-owned) |
| `delegate` | Base |
| `exec_sql` / `exec_insert` | ER after delegate (`skipPreflight: true`). Local tests run these on the validator. |
| `exec_select` | ER (`skipPreflight: true`) |
| `commit` / `undelegate` | ER |
| `schedule_commit_crank` | ER (`skipPreflight: true`) |
| `crank_commit` | ER (Magic invokes; no user signer). Uses the delegated Slab as MagicIntent payer plus the validator `magic_fee_vault`. |

## Stack

- Anchor 1.0.2, `ephemeral-rollups-sdk` 0.16.2
- Agave / Solana 3.1.x, SBF platform-tools v1.52
- Bun for TS

## Slices

1. `initialize` + `CREATE TABLE notes` — done. `CREATE TABLE` also inits the PK `Index` PDA.
2. `INSERT` + `SELECT … WHERE` with fixture TXID — done. Row bytes stay off-chain. On-chain: `PagePtr` + PK `Index`. Index cap is 128 keys.
3. Public ER — this tree. `prepare_rel` on L1, delegate, then `CREATE TABLE` and `INSERT` on the public ER. Upload the 8 KiB page to Irys before `INSERT`. Signed `commit` still pushes `catalog_root` to base.
4. Irys write-ack — done. Pack the 8 KiB page, upload, wait for the receipt and gateway bytes, then `INSERT` the Irys id. Row bytes stay off-chain. The public ER suite uses a live Irys id.
5. Commit crank — this tree. Schedule `crank_commit` on the public ER. Magic stamps `catalog_root` and MagicIntent-commits it to base. The crank uses the delegated Slab as payer (see `rewards-delegated-vrf`).

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

The suite resolves the closest public ER validator. Do not send ER txs to `https://devnet.magicblock.app/` — that alias is not a validator RPC. Do not use `https://api.devnet.solana.com`. `prepare_rel` pays Index and PagePtr rent from a system-owned `fee` vault on L1. After delegate, `CREATE TABLE` and `INSERT` only write those PDAs. They do not call System.

## Irys tests

Default `anchor test` does not upload. Live Irys is env-gated. The local validator still runs `INSERT`. Irys funding uses `IRYS_RPC_URL` from `.env` and `~/.config/solana/id.json`.

```bash
RUN_IRYS_TESTS=1 \
  anchor test
```

`INSERT` stores an Irys receipt id in 64 bytes, zero-padded on the right. The program rejects empty or non-ASCII ids. Fetch the page from `https://devnet.irys.xyz/<id>`.

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
