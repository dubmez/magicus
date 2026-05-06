import type { NextConfig } from "next";

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
    ];
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
