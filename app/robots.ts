import type { MetadataRoute } from "next";

// Tell crawlers which paths are worth their time.
//
// /api/* and /auth/* are infrastructure — they have no SEO value and only
// burn the crawl budget. /w/* (shared workflows) are public by design but
// each share is one user's content; we'd rather Google find the landing
// page first, so we leave them allowed but don't enumerate them in a
// sitemap. If we add a public library of curated workflows later, that
// gets its own discoverable surface.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/auth/"],
    },
    host: "https://magicus.io",
    sitemap: "https://magicus.io/sitemap.xml",
  };
}
