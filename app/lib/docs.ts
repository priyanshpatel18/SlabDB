import { readFileSync } from "node:fs";
import { join } from "node:path";

const docsDir = join(process.cwd(), "..", "docs");

export const DOC_PAGES = [
  {
    slug: "",
    title: "Overview",
    file: "README.md",
    description: "Slab docs. Catalog on a MagicBlock public ER. Pages on Irys.",
  },
  {
    slug: "sdk",
    title: "SDK",
    file: "sdk.md",
    description: "TypeScript client for Slab SQL on MagicBlock and Irys.",
  },
  {
    slug: "sql",
    title: "SQL",
    file: "sql.md",
    description: "v0 SQL statements Slab accepts.",
  },
  {
    slug: "skill",
    title: "AI Dev Skill",
    file: "skill.md",
    description: "Install the Slab skill for AI coding tools.",
  },
] as const;

export const LEGAL_PAGES = [
  {
    slug: "privacy",
    title: "Privacy",
    file: "privacy.md",
    description:
      "Privacy Policy for Slab. What is public on Irys and how sign-in works.",
  },
  {
    slug: "terms",
    title: "Terms",
    file: "terms.md",
    description: "Terms and Conditions for Slab and the CLI.",
  },
  {
    slug: "refunds",
    title: "Refunds",
    file: "refunds.md",
    description: "Refund Policy. Slab does not sell a paid product.",
  },
  {
    slug: "cookies",
    title: "Cookies",
    file: "cookies.md",
    description:
      "Cookie Policy. Necessary sign-in storage and optional analytics.",
  },
] as const;

export type DocSlug = (typeof DOC_PAGES)[number]["slug"];
export type LegalSlug = (typeof LEGAL_PAGES)[number]["slug"];

export function docHref(slug: string): string {
  return slug ? `/docs/${slug}` : "/docs";
}

export function legalHref(slug: string): string {
  return `/${slug}`;
}

export function findDoc(slug: string | undefined) {
  const key = slug ?? "";
  return DOC_PAGES.find((page) => page.slug === key) ?? null;
}

export function findLegal(slug: string | undefined) {
  return LEGAL_PAGES.find((page) => page.slug === slug) ?? null;
}

export function docNeighbors(slug: string) {
  const index = DOC_PAGES.findIndex((page) => page.slug === slug);
  if (index < 0) {
    return { prev: null, next: null };
  }
  return {
    prev: index > 0 ? DOC_PAGES[index - 1] : null,
    next: index < DOC_PAGES.length - 1 ? DOC_PAGES[index + 1] : null,
  };
}

export function readDoc(file: string): string {
  return readFileSync(join(docsDir, file), "utf8");
}
