import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  const routes: {
    path: string;
    priority: number;
    changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
  }[] = [
    { path: "/", priority: 1, changeFrequency: "weekly" },
    { path: "/docs", priority: 0.9, changeFrequency: "weekly" },
    { path: "/docs/sdk", priority: 0.8, changeFrequency: "monthly" },
    { path: "/docs/sql", priority: 0.8, changeFrequency: "monthly" },
    { path: "/docs/skill", priority: 0.8, changeFrequency: "monthly" },
    { path: "/console", priority: 0.8, changeFrequency: "weekly" },
  ];

  return routes.map(({ path, priority, changeFrequency }) => ({
    url: absoluteUrl(path),
    lastModified,
    changeFrequency,
    priority,
  }));
}
