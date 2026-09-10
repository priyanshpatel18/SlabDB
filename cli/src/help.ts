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

init creates .slab in this directory. clone copies a public profile repo to disk.
add stages files. commit snapshots the index. push writes the commit to Slab.
`;
