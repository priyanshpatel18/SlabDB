import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DocsProse } from "@/components/docs-prose";
import { DocsShell } from "@/components/docs-shell";
import { DOC_PAGES, findDoc, readDoc } from "@/lib/docs";
import { getSEOTags } from "@/lib/seo";

type DocsParams = { slug?: string[] };

export function generateStaticParams(): DocsParams[] {
  return DOC_PAGES.map((page) => ({
    slug: page.slug ? [page.slug] : [],
  }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<DocsParams>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = findDoc(slug?.[0]);
  if (!page) {
    return getSEOTags({ title: "Docs", canonicalUrlRelative: "/docs" });
  }
  const path = page.slug ? `/docs/${page.slug}` : "/docs";
  return getSEOTags({
    title: page.title,
    description: "Slab docs. SDK, SQL, and the AI Dev Skill.",
    canonicalUrlRelative: path,
    openGraph: { title: `${page.title} | Slab` },
  });
}

export default async function DocsPage({
  params,
}: {
  params: Promise<DocsParams>;
}) {
  const { slug } = await params;
  const page = findDoc(slug?.[0]);
  if (!page || (slug && slug.length > 1)) {
    notFound();
  }
  const source = readDoc(page.file);
  return (
    <DocsShell slug={page.slug}>
      <DocsProse source={source} />
    </DocsShell>
  );
}
