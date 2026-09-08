# Brand: Slab

_Status: active_

Kiln / sediment. The product is a stone slab of pages, not a neon dashboard.

## Direction

Workstation-dense console on a stark landing. One accent. Warm stone, not cool gray.

## Palette (OKLCH), dark only

Hue **54** (fired copper) for ink, surfaces, and the only accent. Hue **78** (bone) for text.

| Token | Value | Role |
| --- | --- | --- |
| `--background` | kiln 0.175 | Page |
| `--foreground` | bone 0.93 | Text |
| `--primary` / `--kiln` | copper 0.76 | Actions, ER live |
| `--muted-foreground` | 0.68 | Labels |
| `--destructive` | brick 28° | Errors only |
| `--spotlight` / `--beam-*` | copper, low chroma | Aceternity, no cyan/violet |

No light theme. `html` is always `.dark`. `color-scheme: dark`.

Do not introduce a second accent. Charts stay in the copper-ochre family.

## Type

- UI: IBM Plex Sans
- Data / SQL: IBM Plex Mono
- Wordmark only: Newsreader italic

## Radius

`--radius: 0.28rem` on controls. Console panels are flush (`rounded-none`).

## Voice

Short, specific. Name the 8 KiB page, the public ER, the wallet. No “build the future.”

_Set: 2026-09-08_
