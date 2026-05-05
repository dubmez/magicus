// Single import point for the rest of the app:
//
//   import { storage } from "@/lib/db";
//   await storage.saveWorkflows(...);
//
// The active backend is selected here. Phase 1 has only the local impl;
// Phase 3 adds Supabase and switches via env (`MAGICUS_STORAGE=supabase`).
//
// IMPORTANT: nothing outside this directory should import a backend
// implementation directly — the whole point of this boundary is that the
// rest of the app stays backend-agnostic.

import { localStorageBackend } from "./local";
import type { Storage } from "./storage";

export const storage: Storage = localStorageBackend;

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

// Sync escape hatches — only for hooks that need instant hydration. Avoid
// importing these from new code; prefer `storage.load*()` and a loading
// state. Once we move to a remote backend, these become no-ops or get
// removed entirely.
export {
  readWorkflowsSync,
  readCanvasesSync,
  readActiveCanvasIdSync,
} from "./local";
