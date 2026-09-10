# Terms and Conditions

Last updated: 10 September 2026.

These terms govern use of **Slab** at `https://slab.priyanshpatel.com` and the Slab CLI. If you do not agree, do not use Slab.

Contact: [GitHub issues](https://github.com/priyanshpatel18/SlabDB/issues).

## The service

Slab is onchain GitHub. You can publish a public profile and public repositories. File pages are 8 KiB objects on Irys. Catalog logic runs on a MagicBlock public Ephemeral Rollup. Solana L1 is used for init, prepare, delegate, and commit.

The software is provided on **devnet** unless the site says otherwise. Devnet tokens have no cash value.

## Accounts

You sign in with Privy (email or Google). Slab uses the Privy Solana embedded wallet. You are responsible for that wallet and for any token you store in `~/.config/slab/credentials.json`.

Username `new` and other reserved names are not available. You must not impersonate another person.

## Public data

Everything you publish (profile, repos, files, commits) is public. Anyone can read Irys pages and rollup pointers. See the [Privacy Policy](/privacy).

You grant Slab a worldwide, non-exclusive licence to host, copy, and display that public content so the service can run.

## Acceptable use

You must not use Slab to:

- Break the law.
- Publish malware, exploits, or instructions whose main purpose is harm.
- Publish sexual content that involves minors.
- Publish other people’s personal data without a lawful basis.
- Attack the site, the program, or other users (including spam and credential stuffing).
- Bypass rate limits or scrape in a way that harms the service.

We may hide, drop, or refuse content that breaks these rules. On-chain and Irys copies may still exist.

## No paid Slab product

Slab does not sell subscriptions or file storage plans. Network fees (SOL, Irys) are paid to those networks, not to Slab as a refundable product fee. See the [Refund Policy](/refunds).

## CLI and API

`slab login` stores a user token on your machine. `slab push` may only write to a repository you own. Do not share that token. Do not put `PRIVY_AUTHORIZATION_KEY` in the CLI.

## Third parties

Privy, Google (if you use Google login), Irys, MagicBlock, and Solana RPC providers are separate services. Their terms apply to their systems.

## Intellectual property

Slab, the kiln lockup, and the site design belong to the project. The protocol client `slabdb` is licensed as stated in the repository. You keep rights in content you authored, subject to the public licence above.

## Disclaimer

Slab is provided **as is**. We do not warrant uptime, durability of every Irys page, or that the CLI or API will always accept a push. Devnet can reset. You use Slab at your own risk.

To the limit the law allows, Slab is not liable for lost keys, lost tokens, lost content, or damages that arise from public data you published.

## Indemnity

You will cover Slab for claims that arise from your content or your use of the service, to the limit the law allows.

## Law

If a court needs a governing law and you and Slab do not agree otherwise, the laws of India apply, excluding conflict-of-law rules. Some consumer laws cannot be waived.

## Changes

We may update these terms. The date at the top will change. If you keep using Slab after a change, you accept the new terms.
