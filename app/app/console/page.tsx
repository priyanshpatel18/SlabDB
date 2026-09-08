import type { Metadata } from "next";
import { Console } from "@/components/console";
import { getSEOTags } from "@/lib/seo";

export const metadata: Metadata = getSEOTags({
  title: "Console",
  description:
    "SQL workstation for Slab. Local preview of the v0 subset in this browser.",
  canonicalUrlRelative: "/console",
  openGraph: {
    title: "Console | Slab",
  },
});

export default function ConsolePage() {
  return <Console />;
}
