import type { Metadata } from "next";
import { site, SEO_KEYWORDS } from "@/lib/site";

const stripTrailingSlash = (url: string) => url.replace(/\/+$/, "");

const getBaseURL = () => {
  if (process.env.NEXT_PUBLIC_SITE_URL)
    return stripTrailingSlash(process.env.NEXT_PUBLIC_SITE_URL);
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL)
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  if (process.env.NODE_ENV !== "development")
    return `https://${site.domainName}`;
  return "http://localhost:3000";
};

export const BASE_URL = getBaseURL();

export function absoluteUrl(path = "/"): string {
  const base = stripTrailingSlash(BASE_URL);
  if (!path || path === "/") return base;
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${base}${stripTrailingSlash(normalized)}`;
}

export const getSEOTags = ({
  title,
  description,
  keywords,
  openGraph,
  canonicalUrlRelative,
  extraTags,
}: Metadata & {
  canonicalUrlRelative?: string;
  extraTags?: Metadata;
} = {}): Metadata => {
  const resolvedTitle = title || site.appName;
  const resolvedDescription = description || site.appDescription;
  const pageUrl = absoluteUrl(canonicalUrlRelative || "/");
  const ogUrl =
    typeof openGraph?.url === "string" ? openGraph.url : pageUrl;
  const ogImage = {
    url: absoluteUrl("/og.png"),
    width: 1200,
    height: 630,
    alt: "Slab logo and wordmark. Onchain GitHub.",
    type: "image/png",
  };
  const ogImages = openGraph?.images ?? [ogImage];
  const twitterImage = (() => {
    const first = Array.isArray(ogImages) ? ogImages[0] : ogImages;
    if (typeof first === "string") {
      return first;
    }
    if (first && typeof first === "object" && "url" in first) {
      return String(first.url);
    }
    return ogImage.url;
  })();

  return {
    title: resolvedTitle,
    description: resolvedDescription,
    keywords: keywords || [...SEO_KEYWORDS],
    applicationName: site.appName,
    manifest: "/manifest.webmanifest",
    metadataBase: new URL(BASE_URL),
    openGraph: {
      title: openGraph?.title || resolvedTitle,
      description: openGraph?.description || resolvedDescription,
      url: ogUrl,
      siteName: site.appName,
      locale: "en_US",
      type: "website",
      images: ogImages,
    },
    twitter: {
      card: "summary_large_image",
      title: openGraph?.title || resolvedTitle,
      description: openGraph?.description || resolvedDescription,
      images: [twitterImage],
    },
    ...(canonicalUrlRelative
      ? { alternates: { canonical: pageUrl } }
      : {}),
    ...extraTags,
  };
};

type SchemaTagsProps = {
  name?: string;
  description?: string;
  path?: string;
  applicationCategory?: string;
  operatingSystem?: string;
};

export const renderSchemaTags = ({
  name = site.appName,
  description = site.appDescription,
  path = "/",
  applicationCategory = "DeveloperApplication",
  operatingSystem = "Web",
}: SchemaTagsProps = {}) => {
  const url = absoluteUrl(path);
  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        name: site.appName,
        url: BASE_URL,
        logo: absoluteUrl("/logo.png"),
      },
      {
        "@type": "WebSite",
        name: site.appName,
        url: BASE_URL,
        description: site.appDescription,
      },
      {
        "@type": "SoftwareApplication",
        name,
        description,
        image: absoluteUrl("/og.png"),
        url,
        author: {
          "@type": "Organization",
          name: site.appName,
          url: BASE_URL,
        },
        applicationCategory,
        operatingSystem,
        offers: {
          "@type": "Offer",
          price: 0,
          priceCurrency: "USD",
        },
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
};
