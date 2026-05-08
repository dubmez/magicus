"use client";

import { useEffect, useRef } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { bumpViewCount } from "@/lib/explainers";
import type { SupabaseClient } from "@supabase/supabase-js";

// Bumps view_count once per page mount via the security-definer RPC.
// Idempotent within the same React render cycle (the ref guards against
// dev-mode StrictMode double-invocation). Failure is silent — view-count
// drift is a non-event vs blocking the page render.
export function ViewCountTicker({ token }: { token: string }) {
  const firedRef = useRef(false);
  useEffect(() => {
    if (firedRef.current) return;
    firedRef.current = true;
    const client = supabaseBrowser() as unknown as SupabaseClient;
    bumpViewCount(client, token).catch((err) => {
      console.warn("[explainer] view count bump failed", err);
    });
  }, [token]);
  return null;
}
