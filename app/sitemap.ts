import type { MetadataRoute } from "next";

// Single-entry sitemap for the landing page. Shared workflow URLs
// (/w/[token]) are intentionally not enumerated — they're personal,
// not content we're trying to rank.
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    {
      url: "https://magicus.io",
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: "https://magicus.io/privacy",
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: "https://magicus.io/terms",
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];
}
