import type { Metadata } from "next";

// Static social meta stub for shared workflow pages.
//
// Shares are localStorage-only today, so the server can't read the workflow
// name to render dynamic OG/Twitter cards. This stub gives crawlers and chat
// previews a sensible, branded fallback. Once shares move to a backend, swap
// this for a `generateMetadata` that fetches the workflow by token.
export const metadata: Metadata = {
  title: "A workflow on Magicus",
  description: "Map, share, and remix business workflows. Free during the open beta.",
  openGraph: {
    title: "A workflow on Magicus",
    description: "Map, share, and remix business workflows. Free during the open beta.",
    type: "article",
    siteName: "Magicus",
    // OG image is a future TODO — needs a server-side renderer or a per-share
    // pre-baked image. Crawlers will fall back to no image gracefully.
  },
  twitter: {
    card: "summary_large_image",
    title: "A workflow on Magicus",
    description: "Map, share, and remix business workflows. Free during the open beta.",
  },
};

export default function ShareLayout({ children }: { children: React.ReactNode }) {
  return children;
}
