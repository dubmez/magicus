import type { NextConfig } from "next";

// The finance demo's Agents and Track screens live in a separate app (the control
// layer) and are served here through rewrites, so the viewer stays on magicus.io.
// Phase 1 of bringing them together: route, don't merge.
const AGENTS_ZONE =
  process.env.AGENTS_ZONE_URL ?? "https://finops-control.vercel.app";

const nextConfig: NextConfig = {
  // ─── Security headers ─────────────────────────────────────────────────
  // Applied to every response. Doesn't include CSP yet — that needs
  // careful crafting around the Supabase auth iframe + inline styles
  // and we'd rather ship a working baseline than a broken aspiration.
  // HSTS is set by Vercel automatically.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Block clickjacking. SAMEORIGIN allows our own pages to embed
          // each other (e.g. the OAuth handshake popup) but rejects
          // third-party iframes.
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          // Stop browsers from MIME-sniffing a response away from its
          // declared Content-Type.
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Send a referrer to same-origin requests (useful for analytics)
          // and a stripped-down origin to cross-origin requests.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Lock down powerful browser APIs to first-party only. We need
          // camera/microphone/display-capture for the recording flow;
          // everything else is denied.
          {
            key: "Permissions-Policy",
            value:
              "camera=(self), microphone=(self), display-capture=(self), geolocation=(), payment=(), usb=()",
          },
        ],
      },
      {
        // Rewrite caching can hand an RSC request a cached HTML response (or
        // the reverse) across the zone boundary. The demo is small; skip it.
        source: "/:zone(agents|track)/:path*",
        headers: [{ key: "x-vercel-enable-rewrite-caching", value: "0" }],
      },
      {
        source: "/:zone(agents|track)",
        headers: [{ key: "x-vercel-enable-rewrite-caching", value: "0" }],
      },
    ];
  },

  // ─── Agents and Track zones ───────────────────────────────────────────
  // beforeFiles so nothing in this app can shadow them. Links into these
  // paths must be plain <a>, never <Link>: a client-side hop across zones
  // would load the other app's payload into this app's router.
  async rewrites() {
    return {
      beforeFiles: [
        { source: "/agents", destination: `${AGENTS_ZONE}/agents` },
        { source: "/agents/:path+", destination: `${AGENTS_ZONE}/agents/:path+` },
        { source: "/track", destination: `${AGENTS_ZONE}/track` },
        { source: "/track/:path+", destination: `${AGENTS_ZONE}/track/:path+` },
        {
          source: "/agents-static/:path+",
          destination: `${AGENTS_ZONE}/agents-static/:path+`,
        },
      ],
    };
  },

  // ─── Canonical host ───────────────────────────────────────────────────
  // 308 www.magicus.io → magicus.io. Avoids duplicate-content SEO
  // ambiguity and means share-link unfurl previews always reference the
  // same canonical hostname.
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.magicus.io" }],
        destination: "https://magicus.io/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
