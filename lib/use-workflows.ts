"use client";

import { useState, useEffect } from "react";
import {
  initialWorkflows,
  myBusinessCanvas,
  examplesCanvas,
  EXAMPLES_CANVAS_ID,
  DEFAULT_CANVAS_ID,
  type Workflow,
  type Canvas,
} from "./workflows";
import {
  storage,
  readWorkflowsSync,
  readCanvasesSync,
  readActiveCanvasIdSync,
} from "./db";

// Migration of pre-trigger workflow shapes left over from earlier seeds.
// Stays here (not in the storage layer) because it's about evolving the
// canonical Workflow shape, not about where the bytes live.
function migrateWorkflows(wfs: Workflow[]): Workflow[] {
  return wfs.map((w) => {
    const leg = w as Record<string, unknown>;
    const out: Record<string, unknown> = { ...leg };
    // tasks → steps
    if (leg.tasks && !leg.steps) { out.steps = leg.tasks; delete out.tasks; }
    // strip removed fields
    delete out.owner;
    delete out.frequency;
    delete out.when;
    // add trigger if missing
    if (!("trigger" in out)) out.trigger = null;
    return out as Workflow;
  });
}

function initWorkflows(): Workflow[] {
  const stored = readWorkflowsSync();
  const base = stored.length > 0 ? migrateWorkflows(stored) : initialWorkflows;
  // Ensure all initial workflows are present so the Examples canvas always has them
  const have = new Set(base.map((w) => w.id));
  const missing = initialWorkflows.filter((w) => !have.has(w.id));
  return missing.length > 0 ? [...base, ...missing] : base;
}

function initCanvases(): Canvas[] {
  const stored = readCanvasesSync();

  if (stored.length === 0) {
    // First run: empty My Business + populated read-only Examples
    return [{ ...myBusinessCanvas }, { ...examplesCanvas }];
  }

  // Existing user — keep their personal canvases but always replace Examples
  // with the current export. We manage that canvas, so updates to the seed
  // data ship to existing users on next load without leaving stale ids
  // around.
  const out = stored.filter((c) => c.id !== EXAMPLES_CANVAS_ID);
  out.push({ ...examplesCanvas });
  return out;
}

export function useWorkflows() {
  // Sync hydration from the local cache for instant render. Writes flow
  // through `storage.*` so swapping in Supabase (Phase 3) only affects the
  // persistence side — the hydration story changes then to a Suspense /
  // loading state.
  const [workflows, setWorkflows] = useState<Workflow[]>(() => initWorkflows());
  const [canvases, setCanvases] = useState<Canvas[]>(() => initCanvases());

  const [activeCanvasId, setActiveCanvasId] = useState<string>(() => {
    const cvs = initCanvases();
    const stored = readActiveCanvasIdSync() ?? "";
    if (cvs.find((c) => c.id === stored)) return stored;
    // Default to the user's editable canvas, not Examples
    const editable = cvs.find((c) => !c.readOnly);
    return editable?.id ?? cvs[0]?.id ?? DEFAULT_CANVAS_ID;
  });

  useEffect(() => {
    void storage.saveWorkflows(workflows);
  }, [workflows]);

  useEffect(() => {
    void storage.saveCanvases(canvases);
  }, [canvases]);

  useEffect(() => {
    void storage.saveActiveCanvasId(activeCanvasId);
  }, [activeCanvasId]);

  const activeCanvas = canvases.find((c) => c.id === activeCanvasId) ?? canvases[0];

  return { workflows, setWorkflows, canvases, setCanvases, activeCanvasId, setActiveCanvasId, activeCanvas };
}
