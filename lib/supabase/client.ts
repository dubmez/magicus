"use client";

import { createBrowserClient } from "@supabase/ssr";

// Single shared browser client. SSR helpers handle cookie sync with
// server components automatically.
//
// Uses the publishable key (formerly "anon"). RLS in the database is what
// keeps this safe — never embed the secret key here.
let cached: ReturnType<typeof createBrowserClient> | null = null;

export function supabaseBrowser() {
  if (cached) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase env vars missing. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (vercel env pull .env.local)."
    );
  }
  cached = createBrowserClient(url, key);
  return cached;
}
