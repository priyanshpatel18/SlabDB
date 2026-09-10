import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { findLegal } from "@/lib/docs";
import { getSEOTags } from "@/lib/seo";

const page = findLegal("refunds");

export const metadata: Metadata = getSEOTags({
  title: page?.title ?? "Refunds",
  description: page?.description,
  canonicalUrlRelative: "/refunds",
  openGraph: { title: "Refunds | Slab" },
});

export default function RefundsRoute() {
  return <LegalPage slug="refunds" />;
}
