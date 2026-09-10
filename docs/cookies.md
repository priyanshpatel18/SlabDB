# Cookie Policy

Last updated: 10 September 2026.

This page describes cookies and similar storage on **Slab** (`https://slab.priyanshpatel.com`). Related: [Privacy Policy](/docs/privacy).

You can change your choice at any time with **Cookie settings** in the footer or the banner.

## How we use storage

Slab uses cookies and web storage for three jobs:

1. **Necessary** — sign-in and security. These run so the site can work.
2. **Preferences** — your cookie choice, stored in `localStorage` as `slab-consent-v1`.
3. **Analytics** — measurement. These do **not** load unless you allow analytics.

Slab does not use advertising cookies today. If that changes, they will stay off until you allow them.

## Necessary (always on)

| Name / storage | Who | Why |
| --- | --- | --- |
| Privy session cookies and local storage | Privy | Email or Google sign-in, embedded Solana wallet |
| `slab-agent:` session flags | Slab | Remember that you enabled the agent signer in this tab |
| `slab-agent-guide` | Slab | Remember that you dismissed the agent guide in this tab |
| Theme class on `html` | Slab | Dark theme only |

Without necessary storage, you cannot stay signed in. The cookie banner does not block these.

If you use **Google** login, Google may set its own cookies on Google’s domains. That is Google’s control. Read [Google cookies](https://policies.google.com/technologies/cookies).

## Analytics (off until you allow)

Slab does not load Google Analytics, ads pixels, or similar tags unless your stored choice has `analytics: true`.

If you pick **Necessary only**, no analytics tag runs.

If you pick **Allow analytics**, Slab may measure page views with a privacy-respecting tag. We will name that tag here when one is wired. Until then, Allow analytics stores your consent and still loads no extra tag.

## CLI

The CLI is not a browser. It stores a user token in `~/.config/slab/credentials.json` on your computer. That is not a website cookie.

## How to control cookies

- Use the banner: **Necessary only** or **Allow analytics**.
- Use **Cookie settings** in the footer.
- Clear site data in your browser to wipe Privy session and `slab-consent-v1`.

Browser “Do Not Track” does not change necessary sign-in cookies.

## Contact

[GitHub issues](https://github.com/priyanshpatel18/SlabDB/issues).
