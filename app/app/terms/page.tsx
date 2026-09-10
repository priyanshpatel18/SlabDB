import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { findLegal } from "@/lib/docs";
import { getSEOTags } from "@/lib/seo";

const page = findLegal("terms");

export const metadata: Metadata = getSEOTags({
  title: page?.title ?? "Terms",
  description: page?.description,
  canonicalUrlRelative: "/terms",
  openGraph: { title: "Terms | Slab" },
});

export default function TermsRoute() {
  return <LegalPage slug="terms" />;
}
