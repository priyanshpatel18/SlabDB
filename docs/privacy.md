# Privacy Policy

Last updated: 10 September 2026.

This policy describes how **Slab** (`https://slab.priyanshpatel.com`) handles information. Slab is onchain GitHub. Catalog data runs on a MagicBlock public Ephemeral Rollup. File pages are 8 KiB objects on Irys.

Contact: [GitHub issues](https://github.com/priyanshpatel18/SlabDB/issues).

## Summary

- Repos, profiles, and file bytes on Slab are **public**.
- Sign-in uses Privy (email or Google) and a Solana embedded wallet.
- Slab does not sell your data.
- Slab does not load analytics or advertising pixels unless you allow analytics cookies.

## What is public

| Piece | Where it lives | Who can read it |
| --- | --- | --- |
| Row bytes | 8 KiB pages on Irys | Anyone with the Irys id |
| Catalog, PagePtr, indexes | Public Ephemeral Rollup, then L1 after commit | Anyone who can call the public ER or L1 RPC |
| Username, display name, bio, photo, links | Irys username claim | Anyone |
| SQL text | Never on chain | Only the client that parsed it |

`SELECT` from a second session works because the page is on Irys and the pointer is on the rollup. That is data availability. It is not confidentiality.

Do not put secrets, private keys, or personal data you need to keep private in a Slab repo or profile.

## What we collect

**Account (required to publish)**

- Privy user id and access token (session).
- Solana embedded wallet address and wallet id.
- Email or Google account data that Privy collects to create that session.

**Profile and repos (you choose to publish)**

- Username, display name, bio, website, extra links, photo.
- Repository names, file paths, file bodies (max 4 KiB per file), commit messages, and timestamps.

**CLI**

- A user token in `~/.config/slab/credentials.json` on your machine. The server checks that token on `/api/cli/me` and `/api/cli/push`. The server signing key never goes in the CLI.

**Technical**

- Server logs that your host may keep (IP, user agent, request path) to operate the site.
- Necessary cookies and storage for sign-in. See the [Cookie Policy](/cookies).

We do not ask for payment card data. Slab does not charge a product fee.

## Sign-in processors

Privy authenticates you and holds the embedded wallet. If you pick Google, Google is a processor for that login. Read [Privy privacy](https://www.privy.io/privacy-policy) and, if you use Google, [Google privacy](https://policies.google.com/privacy).

Irys stores public pages. MagicBlock and Solana RPCs see public transactions.

## What GRANT is

`GRANT` is a Slab writer ACL. The owner of `[slab, owner, ns]` can let another pubkey `INSERT`, `UPDATE`, and `DELETE`. A wallet without a Grant PDA cannot write. **Read is not gated.** Any client that can fetch the catalog and the Irys page can `SELECT`.

MagicBlock Private ER permissions are a different program. Do not mix those names with Slab `GRANT`.

## What Private ER would hide later

Private ER (TEE) can hide **rollup accounts**: catalog, PagePtr, and indexes. It does **not** encrypt Irys pages.

Until Slab encrypts page bytes, the honest sentence is:

> PER would hide catalog and indexes. Row pages on Irys stay public.

Do not claim private SQL, private rows, or private notebooks while pages are plaintext on Irys.

## Cookies and tracking

Necessary cookies and storage run sign-in. Analytics and advertising do not run unless you allow them in the cookie banner. Details: [Cookie Policy](/cookies).

## Legal bases (EEA / UK)

Where GDPR applies: contract (to run the account you request), legitimate interests (to operate a public catalog and keep the site up), and consent (optional analytics). You may object or withdraw consent as described below.

## Retention

Public Irys pages and on-chain pointers can remain on those networks after you delete a row in the app. A `DROP TABLE` or profile change writes a new state. It does not erase every historical Irys upload.

Privy session data follows Privy’s retention. Server logs follow the host’s retention.

## Your rights

You may access, correct, or delete profile fields in Settings. You may sign out. You may close the Privy account through Privy.

You cannot erase public blockchain or Irys history by a button in Slab.

To ask a question, open a [GitHub issue](https://github.com/priyanshpatel18/SlabDB/issues).

## Children

Slab is not for children under 16. Do not create an account for a child.

## Changes

We may update this policy. The date at the top will change. Continued use after a change means you accept the new text.

## Decision (now)

Keep Irys public. Prove public ER, `GRANT` writes, and second-session `SELECT` first. Add Private ER later as an opt-in lane for rollup accounts only. Encryption of pages is a separate change.
