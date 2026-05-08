"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2 } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { publishExplainer } from "@/lib/explainers";
import type { SupabaseClient } from "@supabase/supabase-js";

const CORAL = "#E66B4D";

// Tiny client island so the rest of the draft page stays a server
// component. Updates status → 'published' and routes to the share
// screen on success.
export function PublishButton({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await publishExplainer(
        supabaseBrowser() as unknown as SupabaseClient,
        id
      );
      router.push(`/explainer/published/${id}`);
    } catch (err) {
      console.error("[explainer/publish] failed", err);
      setError("Couldn't publish — try again.");
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      {error && (
        <span style={{ fontSize: 12, color: "#8B2A2A" }}>{error}</span>
      )}
      <button
        onClick={handleClick}
        disabled={busy}
        className="flex items-center gap-2 transition-opacity hover:opacity-95"
        style={{
          background: CORAL,
          color: "#FFFFFF",
          padding: "9px 18px",
          borderRadius: 999,
          fontSize: 13,
          fontWeight: 500,
          border: "none",
          cursor: busy ? "wait" : "pointer",
          opacity: busy ? 0.7 : 1,
        }}
      >
        {busy ? (
          <Loader2 size={13} className="animate-spin" />
        ) : (
          <>
            Publish
            <ArrowRight size={13} />
          </>
        )}
      </button>
    </div>
  );
}
