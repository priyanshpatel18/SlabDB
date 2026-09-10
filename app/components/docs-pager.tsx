import Link from "next/link";
import { docHref, docNeighbors } from "@/lib/docs";

export function DocsPager({ slug }: { slug: string }) {
  const { prev, next } = docNeighbors(slug);
  if (!prev && !next) {
    return null;
  }
  return (
    <nav
      aria-label="Docs pages"
      className="mt-16 grid grid-cols-1 gap-3 sm:grid-cols-2"
    >
      {prev ? (
        <Link
          href={docHref(prev.slug)}
          className="flex min-h-16 flex-col justify-center rounded-lg border border-border px-4 py-3 hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <span className="text-xs text-muted-foreground">Previous</span>
          <span className="text-sm font-medium text-foreground">{prev.title}</span>
        </Link>
      ) : (
        <span className="hidden sm:block" />
      )}
      {next ? (
        <Link
          href={docHref(next.slug)}
          className="flex min-h-16 flex-col justify-center rounded-lg border border-border px-4 py-3 text-right hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <span className="text-xs text-muted-foreground">Next</span>
          <span className="text-sm font-medium text-foreground">{next.title}</span>
        </Link>
      ) : null}
    </nav>
  );
}
