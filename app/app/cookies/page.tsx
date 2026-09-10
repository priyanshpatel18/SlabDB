import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { findLegal } from "@/lib/docs";
import { getSEOTags } from "@/lib/seo";

const page = findLegal("cookies");

export const metadata: Metadata = getSEOTags({
  title: page?.title ?? "Cookies",
  description: page?.description,
  canonicalUrlRelative: "/cookies",
  openGraph: { title: "Cookies | Slab" },
});

export default function CookiesRoute() {
  return <LegalPage slug="cookies" />;
}
