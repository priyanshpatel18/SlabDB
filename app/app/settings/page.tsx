import type { Metadata } from "next";
import { ProfileSettings } from "@/components/profile-settings";
import { getSEOTags } from "@/lib/seo";

export const metadata: Metadata = getSEOTags({
  title: "Settings",
  description: "Public profile for this Slab wallet.",
  canonicalUrlRelative: "/settings",
  openGraph: { title: "Settings | Slab" },
});

export default function SettingsPage() {
  return <ProfileSettings />;
}
