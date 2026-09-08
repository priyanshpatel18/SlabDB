import type { Metadata } from "next";
import { site, SEO_KEYWORDS } from "@/lib/site";

const getBaseURL = () => {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL)
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  if (process.env.NODE_ENV !== "development")
    return `https://${site.domainName}`;
  return "http://localhost:3000";
};

export const BASE_URL = getBaseURL();

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
      url: openGraph?.url || BASE_URL,
      siteName: site.appName,
      locale: "en_US",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: openGraph?.title || resolvedTitle,
      description: openGraph?.description || resolvedDescription,
    },
    ...(canonicalUrlRelative
      ? { alternates: { canonical: canonicalUrlRelative } }
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
  const url = `${BASE_URL}${path}`;
  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        name: site.appName,
        url: BASE_URL,
        logo: `${BASE_URL}/icon.svg`,
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
        image: `${BASE_URL}/opengraph-image`,
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
