import { NextResponse } from "next/server";
import { absoluteUrl } from "@/lib/seo";

export function GET() {
  const body = `# Slab

> Onchain GitHub. Catalog on a MagicBlock public Ephemeral Rollup. Pages on Irys.

## Docs

- [Overview](${absoluteUrl("/docs")})
- [SDK](${absoluteUrl("/docs/sdk")})
- [SQL](${absoluteUrl("/docs/sql")})
- [AI Dev Skill](${absoluteUrl("/docs/skill")})

## Legal

- [Privacy](${absoluteUrl("/privacy")})
- [Terms](${absoluteUrl("/terms")})
- [Refunds](${absoluteUrl("/refunds")})
- [Cookies](${absoluteUrl("/cookies")})

## Skill

\`\`\`bash
npx skills add https://github.com/priyanshpatel18/SlabDB
\`\`\`
`;
  return new NextResponse(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
