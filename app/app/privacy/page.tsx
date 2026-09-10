import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { findLegal } from "@/lib/docs";
import { getSEOTags } from "@/lib/seo";

const page = findLegal("privacy");

export const metadata: Metadata = getSEOTags({
  title: page?.title ?? "Privacy",
  description: page?.description,
  canonicalUrlRelative: "/privacy",
  openGraph: { title: "Privacy | Slab" },
});

export default function PrivacyRoute() {
  return <LegalPage slug="privacy" />;
}
