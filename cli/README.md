# slab CLI

Git-like commands for onchain Slab repos. Files live in a table `(path text PRIMARY KEY, body text NOT NULL)` on the `home` namespace. Pages are on Irys.

```bash
bun run --cwd cli src/index.ts
# or, from this folder:
bun src/index.ts
```

Wallet: `ANCHOR_WALLET` or `~/.config/solana/id.json`. Optional `--keypair <path>`.

## Commands

```bash
slab init [repo]
slab clone <uid[/repo]> [dir]
slab add <path...>
slab commit -m "<message>"
slab push
```

`init` is local only. `clone` reads a public username claim on Irys, then `SELECT`s that owner's table. `add` and `commit` stay on disk. `push` `CREATE TABLE`s if needed, then `INSERT` / `UPDATE` on the public ER.

Body cap is 4,096 bytes per file. Binary files are skipped.
