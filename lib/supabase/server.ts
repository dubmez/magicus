import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Per-request server client — reads/writes session cookies via Next 16's
// async cookies() API. Use this inside server components, server actions,
// and route handlers that need the authenticated user.
//
// Uses the publishable key, never the secret key. Reads still respect RLS
// on behalf of the signed-in user. For admin operations that need to
// bypass RLS, build a separate client from `supabaseAdmin()` below.
export async function supabaseServer() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase env vars missing on server.");
  }
  const cookieStore = await cookies();
  return createServerClient(url, key, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        // Next refuses cookie writes from RSC; the SSR helper swallows the
        // exception and routes us through middleware/route-handler context
        // where writes are allowed.
        try {
          for (const c of toSet) cookieStore.set(c.name, c.value, c.options);
        } catch {
          /* RSC — no-op; the next request will refresh */
        }
      },
    },
  });
}

// Admin client using the service-role / secret key. Bypasses RLS — use
// sparingly and only for explicit admin tasks (seeding, maintenance,
// trusted server-to-server flows). Never expose to the browser.
export function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret) {
    throw new Error(
      "supabaseAdmin requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY."
    );
  }
  // Lazy import to keep the regular runtime cost low; admin clients rarely
  // run in the hot path.
  const { createClient } = require("@supabase/supabase-js") as typeof import("@supabase/supabase-js");
  return createClient(url, secret, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
