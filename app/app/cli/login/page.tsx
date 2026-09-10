import { Suspense } from "react";
import type { Metadata } from "next";
import { CliLogin } from "@/components/cli-login";
import { SiteHeader } from "@/components/site-header";
import { getSEOTags } from "@/lib/seo";

export const metadata: Metadata = getSEOTags({
  title: "CLI login",
  description: "Sign in to the Slab CLI.",
  canonicalUrlRelative: "/cli/login",
  extraTags: { robots: { index: false, follow: false } },
});

export default function CliLoginPage() {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-4 py-12">
        <Suspense fallback={<p className="text-sm text-muted-foreground">Loading</p>}>
          <CliLogin />
        </Suspense>
      </main>
    </div>
  );
}
