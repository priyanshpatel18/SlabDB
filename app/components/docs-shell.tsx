import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { DOC_PAGES, docHref } from "@/lib/docs";
import { cn } from "cn";

export function DocsShell({
  slug,
  children,
}: {
  slug: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background">
      <div className="shrink-0">
        <SiteHeader />
      </div>
      <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col lg:flex-row lg:px-10">
        <aside className="w-full shrink-0 border-b border-border px-4 py-4 sm:px-6 lg:w-52 lg:border-b-0 lg:py-12 lg:pl-0 lg:pr-8">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            Docs
          </p>
          <nav aria-label="Documentation" className="mt-3 flex flex-row flex-wrap gap-2 lg:flex-col lg:gap-0.5">
            {DOC_PAGES.map((page) => {
              const href = docHref(page.slug);
              const active = page.slug === slug;
              return (
                <Link
                  key={page.file}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "shrink-0 rounded-md px-2 py-2 text-sm lg:w-full",
                    active
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {page.title}
                </Link>
              );
            })}
          </nav>
        </aside>
        <div className="slab-scroll-quiet min-h-0 min-w-0 flex-1 px-4 py-8 sm:px-6 lg:px-0 lg:py-12">
          <main id="main-content" tabIndex={-1}>
            {children}
          </main>
          <SiteFooter />
        </div>
      </div>
    </div>
  );
}
