import "server-only";
import { cache } from "react";
import { supabaseServer } from "@/lib/supabase/server";
import type { ShareSettings } from "./types";

// Server-side share fetcher.
//
// Wrapped in React's `cache()` so a single render can call this from both
// `generateMetadata` and the page body without making two queries — Next
// dedupes per-request. Returns null when the token doesn't exist; the
// page handles the "not available" rendering itself.
//
// Public-readable shares mean we don't need an authenticated session;
// anon SELECT is allowed by the RLS policy. Using supabaseServer keeps
// the auth cookie in place for any other authenticated reads on the
// same page.

type ShareRow = {
  token: string;
  user_id: string;
  workflow_data: ShareSettings["workflow"];
  redactions: ShareSettings["redactions"];
  shared_by: ShareSettings["sharedBy"];
  public_library: boolean;
  remix_count: number;
  created_at: string;
};

function rowToShare(row: ShareRow): ShareSettings {
  return {
    token: row.token,
    workflow: row.workflow_data,
    sharedBy: row.shared_by,
    redactions: row.redactions,
    publicLibrary: row.public_library,
    remixCount: row.remix_count,
    createdAt: new Date(row.created_at).getTime(),
  };
}

export const loadShareServer = cache(
  async (token: string): Promise<ShareSettings | null> => {
    const supabase = await supabaseServer();
    const { data, error } = await supabase
      .from("shares")
      .select(
        "token, user_id, workflow_data, redactions, shared_by, public_library, remix_count, created_at"
      )
      .eq("token", token)
      .maybeSingle();

    if (error) {
      // Surface the failure — generateMetadata + page can decide how to
      // present it (typically render the "not available" view).
      console.warn("[loadShareServer] supabase select failed", error);
      return null;
    }
    return data ? rowToShare(data as ShareRow) : null;
  }
);
