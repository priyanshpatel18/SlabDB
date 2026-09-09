# AI Dev Skill

Slab development skill for AI coding agents. It covers the `slabdb` SDK, v0 SQL, public Ephemeral Rollup routing, and Irys pages.

[Skill source on GitHub](https://github.com/priyanshpatel18/SlabDB/blob/main/.cursor/skills/slabdb/SKILL.md)

## Quick install

```bash
npx skills add https://github.com/priyanshpatel18/SlabDB
```

## What it is

The Slab skill packages protocol rules so an agent does not need a long prompt each time. It activates when you ask about Slab, `slabdb`, or SQL on MagicBlock.

It is for teams working on:

- The `slabdb` TypeScript SDK
- CREATE TABLE on base, then writes on the public ER
- 8 KiB Irys-shaped pages
- Dual connection: MagicBlock base RPC plus the public ER router
- The website console that uses the same SDK

## Installation

### Quick install

```bash
npx skills add https://github.com/priyanshpatel18/SlabDB
```

### Project copy

Copy `.cursor/skills/slabdb/SKILL.md` from this repo into your project `.cursor/skills/slabdb/` folder.

## Usage

The skill activates when you mention Slab, slabdb, or onchain SQL on MagicBlock.

In Claude Code you can invoke it with `/slabdb`.

In Codex say `use the slabdb skill`.

Examples:

```text
Add INSERT for a notes table on the public ER
Wire SlabDb with programEr after delegate
Do not confirm this ER tx on L1 lastValidBlockHeight
```

## What the skill adds

- When to use base vs the public ER
- `skipPreflight` and processed for ER sends
- Pin `@solana/web3.js` to `1.98.4` and Anchor to `1.0.2`
- Do not use `https://devnet.magicblock.app/` as validator RPC
- Do not put Helius keys in the client
- Browser pages stay in the tab until Irys upload
- Node Irys store is `slabdb/node` only
