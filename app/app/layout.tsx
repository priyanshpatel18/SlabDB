import type { Metadata, Viewport } from "next";
import { Providers } from "@/components/providers";
import { getSEOTags } from "@/lib/seo";
import { SEO_KEYWORDS } from "@/lib/site";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#2c241c",
};

const defaultTitle = "Slab: onchain GitHub";

export const metadata: Metadata = {
  ...getSEOTags({
    title: defaultTitle,
    description:
      "Onchain GitHub. Profiles, repos, and README on MagicBlock and Irys.",
    keywords: [...SEO_KEYWORDS],
    canonicalUrlRelative: "/",
  }),
  title: {
    default: defaultTitle,
    template: "%s | Slab",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="dark h-full font-sans antialiased" suppressHydrationWarning>
      <body className="flex min-h-full flex-col overflow-x-hidden bg-background font-sans text-foreground">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
