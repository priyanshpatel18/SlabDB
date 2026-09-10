export const HELP = `Slab is onchain GitHub.

Usage:
  slab init [repo]
  slab clone <uid[/repo]> [dir]
  slab add <path...>
  slab commit -m <message>
  slab push

Options:
  --keypair <path>   Solana keypair JSON. Default ANCHOR_WALLET or ~/.config/solana/id.json
  -h, --help         Show this help

init creates .slab in this directory. clone copies a public repo to disk.
push writes changed files and a commit to Slab.
`;
