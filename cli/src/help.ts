export const HELP = `Slab is onchain GitHub.

Usage:
  slab init [repo]
  slab clone <uid[/repo]> [dir]
  slab login [--api <url>] [--token <token>]
  slab logout
  slab remote add [origin] <url>
  slab remote
  slab add <path...>
  slab commit -m <message>
  slab push

Options:
  --api <url>        Slab site for login. Default SLAB_API or https://slab.priyanshpatel.com
  --token <token>    Paste a CLI token instead of the browser
  --keypair <path>   Legacy local-wallet push. Default ANCHOR_WALLET
  -h, --help         Show this help

init, add, commit, and remote add stay on disk.
login stores a user token in ~/.config/slab/credentials.json.
push sends that commit to /api/cli/push for the remote uid/repo.
`;
