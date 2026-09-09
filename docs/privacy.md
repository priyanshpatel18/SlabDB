# Privacy

Slab today is a **public** catalog. Do not start a private Ephemeral Rollup until this document still matches the code.

## What is public

| Piece | Where it lives | Who can read it |
| --- | --- | --- |
| Row bytes | 8 KiB pages on Irys | Anyone with the Irys id |
| Catalog, PagePtr, indexes | Public Ephemeral Rollup, then L1 after commit | Anyone who can call the public ER or L1 RPC |
| SQL text | Never on chain | Only the client that parsed it |

`SELECT` from a second session works because the page is on Irys and the pointer is on the rollup. That is the data-availability claim. It is not confidentiality.

## What GRANT is

`GRANT` is a Slab writer ACL. The owner of `[slab, owner, ns]` can let another pubkey `INSERT`, `UPDATE`, and `DELETE`. A wallet without a Grant PDA cannot write. **Read is not gated.** Any client that can fetch the catalog and the Irys page can `SELECT`.

MagicBlock Private ER permissions are a different program (auth token, TEE, Permission PDA). Do not mix those names with Slab `GRANT`.

## What Private ER would hide later

Private ER (TEE) can hide **rollup accounts**: catalog, PagePtr, and indexes. It does **not** encrypt Irys pages.

Until Slab encrypts page bytes, the honest sentence is:

> PER would hide catalog and indexes. Row pages on Irys stay public.

Do not claim private SQL, private rows, or private notebooks while pages are plaintext on Irys.

## Decision (now)

Keep Irys public. Prove public ER, `GRANT` writes, and second-session `SELECT` first. Add Private ER later as an opt-in lane for rollup accounts only. Encryption of pages is a separate change.
