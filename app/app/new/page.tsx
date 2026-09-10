import type { Metadata } from "next";
import { NewRepo } from "@/components/new-repo";
import { getSEOTags } from "@/lib/seo";

export const metadata: Metadata = getSEOTags({
  title: "New repository",
  description: "Create a new Slab repository.",
  canonicalUrlRelative: "/new",
  openGraph: { title: "New repository | Slab" },
});

export default function NewRepoPage() {
  return <NewRepo />;
}
