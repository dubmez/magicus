// Single import point for the rest of the app:
//
//   import { storage } from "@/lib/db";
//   await storage.saveWorkflows(...);
//
// Backend selected at module load via NEXT_PUBLIC_MAGICUS_STORAGE.
// Default is `local` (the localStorage backend) so opting into Supabase
// is an explicit choice — keeps prod behaviour unchanged until the env
// flips, which is how we'll roll out Phase 3 safely.
//
// IMPORTANT: nothing outside this directory should import a backend
// implementation directly — the whole point of this boundary is that the
// rest of the app stays backend-agnostic.

import { localStorageBackend } from "./local";
import { supabaseBackend } from "./supabase";
import type { Storage } from "./storage";

type Backend = "local" | "supabase";

function pickBackend(): Backend {
  // NEXT_PUBLIC_ so client and server agree at build time. We could let
  // server be different but that complicates the mental model — keep
  // it simple while we're rolling out.
  const v = (process.env.NEXT_PUBLIC_MAGICUS_STORAGE ?? "local").toLowerCase();
  return v === "supabase" ? "supabase" : "local";
}

const backend: Backend = pickBackend();

export const storage: Storage =
  backend === "supabase" ? supabaseBackend : localStorageBackend;

export const storageBackend = backend;

export type { Storage } from "./storage";
export type {
  Workflow,
  Canvas,
  Connection,
  Step,
  Theme,
  Trigger,
  IOItem,
  RemixedFrom,
  AutomationPotential,
  ShareSettings,
  ShareRedactions,
} from "./types";

// Sync escape hatches — only for hooks that need instant hydration on
// the local backend. With Supabase active, these still read from the
// localStorage cache (write-through, see lib/db/supabase.ts comments)
// and the UI revalidates from Supabase asynchronously.
export {
  readWorkflowsSync,
  readCanvasesSync,
  readActiveCanvasIdSync,
} from "./local";
