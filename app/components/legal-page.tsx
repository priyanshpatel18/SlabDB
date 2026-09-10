import { DocsProse } from "@/components/docs-prose";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { findLegal, readDoc } from "@/lib/docs";
import { notFound } from "next/navigation";

export function LegalPage({ slug }: { slug: string }) {
  const page = findLegal(slug);
  if (!page) {
    notFound();
  }
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <SiteHeader />
      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto w-full max-w-2xl flex-1 px-4 py-12 sm:px-6"
      >
        <DocsProse source={readDoc(page.file)} />
      </main>
      <SiteFooter />
    </div>
  );
}
