# Brand: Slab

_Status: active_

Kiln / sediment. The product is a stone slab of pages, not a neon dashboard.
Lockup: `public/logo.png` (stacked kiln plates) + `public/wordmark.png` (cream Slab).

## Direction

GitHub-like chrome on kiln stone. One accent. Warm cream text, not white. Warm stone, not cool gray.

## Palette (OKLCH), dark only

Hue **48** (logo copper) for ink, surfaces, and the only accent. Hue **70** (wordmark cream) for text.

| Token | Value | Role |
| --- | --- | --- |
| `--background` | kiln 0.175 | Page |
| `--foreground` / `--bone` | cream 0.936 / 0.038 / 70 (`#fae6cf`) | Text |
| `--primary` / `--kiln` | copper 0.734 / 0.129 / 48 (`#e89058`) | Actions, ER live |
| `--muted-foreground` | 0.82 | Labels |
| `--destructive` | brick 28° | Errors only |
| `--spotlight` / `--beam-*` | copper, low chroma | Aceternity, no cyan/violet |

No light theme. `html` is always `.dark`. `color-scheme: dark`.

Do not introduce a second accent. Charts stay in the copper-ochre family. Do not use white (`#fff`) for UI text.

## Type

GitHub-like system stack. Brand lockup is the PNG wordmark, not live type.

- UI: system UI (`-apple-system`, Segoe UI, Helvetica)
- Paths, SQL, addresses: system mono (`ui-monospace`, SF Mono, Menlo)
- OG cards still embed a sans TTF. Satori cannot use system fonts.

## Radius

`--radius: 0.28rem` on controls. Console panels are flush (`rounded-none`).

## Voice

Short, specific. Name the 8 KiB page, the public ER, the wallet. No “build the future.”

_Set: 2026-09-10_
