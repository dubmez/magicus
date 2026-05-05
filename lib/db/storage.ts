import type { Workflow, Canvas, ShareSettings } from "./types";

// The single boundary the rest of the app calls. All methods are async so
// that swapping in a remote backend (Supabase, Neon, ...) is a matter of
// implementing this interface — no UI refactor required.
//
// Reads are async by contract even though the current `local` impl resolves
// synchronously. Hooks that need instant hydration use the sync escape hatch
// from `./local` directly; remote backends are expected to render a loading
// state until `load*()` resolves.
export interface Storage {
  // Workflows ──────────────────────────────────────────────────────────────
  loadWorkflows(): Promise<Workflow[]>;
  saveWorkflows(workflows: Workflow[]): Promise<void>;

  // Canvases ───────────────────────────────────────────────────────────────
  loadCanvases(): Promise<Canvas[]>;
  saveCanvases(canvases: Canvas[]): Promise<void>;
  loadActiveCanvasId(): Promise<string | null>;
  saveActiveCanvasId(id: string): Promise<void>;

  // Shares ─────────────────────────────────────────────────────────────────
  loadShare(token: string): Promise<ShareSettings | null>;
  loadSharesByWorkflowId(workflowId: string): Promise<ShareSettings[]>;
  saveShare(settings: ShareSettings): Promise<void>;
  incrementRemixCount(token: string): Promise<void>;
}
