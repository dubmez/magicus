// Types + non-storage helpers for shareable workflow links.
//
// Data access (saveShare / getShare / ...) lives behind the storage boundary
// at `@/lib/db`. This file only owns shape and pure helpers so it can be
// imported from server code, tests, and UI without dragging in the
// localStorage layer.

import type { Workflow } from "./workflows";

// Per-share redaction settings — which fields the recipient is allowed to see.
// `true` means visible, `false` means redacted. Step / input / output indices
// are stored as 'hidden' lists rather than per-element booleans so the JSON
// stays small.
export type ShareRedactions = {
  triggerDescription: boolean;
  purpose: boolean;
  tools: boolean;
  classifications: boolean;
  hiddenStepNumbers: number[];
  hiddenInputIndices: number[];
  hiddenOutputIndices: number[];
};

export type ShareSettings = {
  token: string;
  // Snapshot of the workflow at share time. We don't reach back into the
  // sharer's live workflow because (a) it might have been edited or deleted,
  // and (b) the recipient should see what the sharer saw when they shared.
  workflow: Workflow;
  sharedBy: { id: string; name: string; avatarUrl?: string };
  redactions: ShareRedactions;
  publicLibrary: boolean;
  remixCount: number;
  createdAt: number;
};

// URL-safe 10-char token. crypto.randomUUID() is widely available; we strip
// the hyphens and take the first 10 chars for a compact share link.
//
// Phase 3 note: when shares move to Supabase, generation moves server-side
// using crypto.randomBytes(24).toString('base64url') for 192 bits of entropy
// — this client-side helper stays for migration / offline cases.
export function generateShareToken(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID().replace(/-/g, "").slice(0, 10);
  }
  // Fallback for environments without crypto.randomUUID (rare).
  return Math.random().toString(36).slice(2, 12);
}

export function defaultRedactions(): ShareRedactions {
  return {
    triggerDescription: false,
    purpose: false,
    tools: false,
    classifications: false,
    hiddenStepNumbers: [],
    hiddenInputIndices: [],
    hiddenOutputIndices: [],
  };
}
