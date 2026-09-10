# slab CLI

Git-like commands for onchain Slab repos. Files live in a table `(path text PRIMARY KEY, body text NOT NULL)` on the `home` namespace. Pages are on Irys.

```bash
bun run --cwd cli src/index.ts
# or, from this folder:
bun src/index.ts
```

## Commands

```bash
slab init [repo]
slab login [--api <url>] [--token <token>]
slab remote add [origin] <url>
slab add <path...>
slab commit -m "<message>"
slab push
slab clone <uid[/repo]> [dir]
slab logout
```

`init`, `add`, `commit`, and `remote add` stay on disk. `commit` stores an id, parent, message, author, and local timestamp.

`login` opens the Slab site, you sign in with the same account, and the CLI stores a user token in `~/.config/slab/credentials.json`. The server signing key never leaves the server.

`push` POSTs that commit to `/api/cli/push` for the remote `uid/repo`. You can only push to the username on that login.

Default API is `SLAB_API` or `https://slab.priyanshpatel.com`. Local:

```bash
SLAB_API=http://localhost:3000 bun src/index.ts login --api http://localhost:3000
slab remote add http://localhost:3000/your_uid/hello-web
```

Body cap is 4,096 bytes per file. Binary files are skipped.

`--keypair` is a legacy local-wallet push. Prefer `slab login` and `slab push`.
