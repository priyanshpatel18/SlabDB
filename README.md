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
| `exec_sql` / `exec_insert` | Base (creates Index / PagePtr while the fee vault is still system-owned) |
| `delegate` | Base |
| `exec_select` | ER (`skipPreflight: true`) |
| `commit` / `undelegate` | ER |

## Stack

- Anchor 1.0.2, `ephemeral-rollups-sdk` 0.16.2
- Agave / Solana 3.1.x, SBF platform-tools v1.52
- Bun for TS

## Slices

1. `initialize` + `CREATE TABLE notes` — done. `CREATE TABLE` also inits the PK `Index` PDA.
2. `INSERT` + `SELECT … WHERE` with fixture TXID — done. Row bytes stay off-chain. On-chain: `PagePtr` + PK `Index`. Index cap is 128 keys.
3. Public ER — done. Create the table and first page on L1, delegate `Slab` + `Catalog` + `Index` + `PagePtr`, run `SELECT` on ER, commit until `catalog_root` (sha256 of catalog bytes) shows on base.
4. Irys write-ack — this tree. Pack the 8 KiB page, upload, wait for the receipt and gateway bytes, then `INSERT` the 43-byte Irys id. Row bytes stay off-chain.

## Public ER tests

Default `anchor test` stays on the local validator. Public ER is env-gated.

Deploy once, then run only the ER suite (`RUN_ER_TESTS=1` skips the local validator tests). Use MagicBlock's Solana RPC. Public `api.devnet.solana.com` rate-limits program writes.

```bash
solana program deploy target/deploy/slab.so \
  --program-id target/deploy/slab-keypair.json \
  --url https://rpc.magicblock.app/devnet \
  --use-rpc \
  --with-compute-unit-price 50000

RUN_ER_TESTS=1 \
  SLAB_BASE_RPC_URL=https://rpc.magicblock.app/devnet \
  ROUTER_ENDPOINT=https://devnet-router.magicblock.app/ \
  anchor test --skip-local-validator --skip-deploy
```

The suite resolves the closest public ER validator. Do not send ER txs to `https://devnet.magicblock.app/` — that alias is not a validator RPC. Do not use `https://api.devnet.solana.com` for deploy or ER tests; that endpoint rate-limits writes. Index and PagePtr rent is paid from a system-owned `fee` vault on L1. After delegate, that vault is owned by the delegation program, so System cannot create accounts from it on the ER.

## Irys tests

Default `anchor test` does not upload. Live Irys is env-gated. The local validator still runs `INSERT`. Irys funding uses MagicBlock's Solana RPC.

```bash
RUN_IRYS_TESTS=1 \
  SLAB_BASE_RPC_URL=https://rpc.magicblock.app/devnet \
  anchor test
```

`INSERT` stores an Irys receipt id in 64 bytes, zero-padded on the right. The program rejects empty or non-ASCII ids. Fetch the page from `https://devnet.irys.xyz/<id>`.
