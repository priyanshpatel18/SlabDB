# Slab

On-chain SQL catalog for MagicBlock. Pay Arweave once for row pages. Pointers, indexes, and query logic run on a Private Ephemeral Rollup. Solana L1 only does init, delegate, and commit.

Product name is **Slab**. SlabDB is informal.

## v0 lock

- Accounts: `Slab`, `Catalog`, `PagePtr`, `Index`. Pointer-per-key is dead.
- SQL: `CREATE TABLE`, `INSERT`, `SELECT`, PK, `WHERE` on one table. No JOIN, UPDATE, BEGIN, COPY.
- Types: bool, int4, int8, text ≤ 1 KiB, timestamptz.
- Tables: 16 in this slice (Solana inner-ix create cap is 10 KiB). 32 after a realloc ix.
- Write-ack: Irys confirm, then write. This slice uses a fixture TXID.
- Public ER before private ER.

## Routing

| Instruction | Connection |
|---|---|
| `initialize` | Base |
| `delegate` | Base |
| `exec_sql` / `exec_insert` / `exec_select` | ER (`skipPreflight: true`) |
| `commit` / `undelegate` | ER |

## Stack

- Anchor 1.0.2, `ephemeral-rollups-sdk` 0.16.2
- Agave / Solana 3.1.x, SBF platform-tools v1.52
- Bun for TS

## Slices

1. `initialize` + `CREATE TABLE notes` — done. `CREATE TABLE` also inits the PK `Index` PDA.
2. `INSERT` + `SELECT … WHERE` with fixture TXID — this tree. Row bytes stay off-chain. On-chain: `PagePtr` + PK `Index`. Index cap is 128 keys (bytemuck `Pod` array length + 10 KiB create cap).
