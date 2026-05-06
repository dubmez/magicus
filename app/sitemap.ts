import type { MetadataRoute } from "next";

// Single-entry sitemap for the landing page. Shared workflow URLs
// (/w/[token]) are intentionally not enumerated — they're personal,
// not content we're trying to rank.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: "https://magicus.io",
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
  ];
}
