import { readFileSync } from "node:fs";
import { join } from "node:path";

const docsDir = join(process.cwd(), "..", "docs");

export const DOC_PAGES = [
  { slug: "", title: "Overview", file: "README.md" },
  { slug: "sdk", title: "SDK", file: "sdk.md" },
  { slug: "sql", title: "SQL", file: "sql.md" },
  { slug: "skill", title: "AI Dev Skill", file: "skill.md" },
] as const;

export type DocSlug = (typeof DOC_PAGES)[number]["slug"];

export function docHref(slug: string): string {
  return slug ? `/docs/${slug}` : "/docs";
}

export function findDoc(slug: string | undefined) {
  const key = slug ?? "";
  return DOC_PAGES.find((page) => page.slug === key) ?? null;
}

export function readDoc(file: string): string {
  return readFileSync(join(docsDir, file), "utf8");
}
