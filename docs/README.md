# Slab

Slab is a SQL catalog on a MagicBlock public Ephemeral Rollup. Table pages are 8,192 bytes on Irys. Pointers, indexes, and query logic run on the rollup.

Solana L1 only does init, prepare, delegate, and commit.

## Program

`58AARMgjnefMz59oCc4WpnqCmpuR92FfQtNk7mV2Sxet` (devnet)

## Connections

- Base RPC: `https://rpc.magicblock.app/devnet`
- ER router: `https://devnet-router.magicblock.app/`

Do not send ER transactions to `https://devnet.magicblock.app/`. Do not put Helius keys in the app.

## Flow

1. `CREATE TABLE` on base.
2. Delegate the slab.
3. `INSERT`, `UPDATE`, `SELECT`, `DELETE` on the public ER.
4. Do not confirm ER transactions on L1 `lastValidBlockHeight`. Use `skipPreflight` and wait for processed.

## Isolation

Catalog isolation is `[slab, owner, ns]`. Each app can share one schema: the owner key initializes, then `GRANT` lets other wallets `INSERT`.

## Next

- [Install the SDK](sdk.md)
- [v0 SQL](sql.md)
- [AI Dev Skill](skill.md)
