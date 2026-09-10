import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <SiteHeader />
      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-4 py-12"
      >
        <h1 className="text-2xl font-medium tracking-tight">Page not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          That URL is not a Slab page.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex min-h-10 w-fit items-center text-sm text-kiln underline underline-offset-4"
        >
          Home
        </Link>
      </main>
      <SiteFooter />
    </div>
  );
}
