import type { MetadataRoute } from "next";
import { site } from "@/lib/site";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Slab",
    short_name: "Slab",
    description: site.appDescription,
    start_url: "/",
    scope: "/",
    id: "/",
    display: "standalone",
    background_color: "#2c241c",
    theme_color: "#2c241c",
    icons: [
      {
        src: "/icon.svg",
        sizes: "32x32",
        type: "image/svg+xml",
      },
    ],
  };
}
