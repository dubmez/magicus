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

const WF_KEY = "magicus:workflows";
const CANVAS_KEY = "magicus:canvases";
const ACTIVE_KEY = "magicus:active-canvas";

function readLocal<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

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
  const stored = readLocal<Workflow[]>(WF_KEY, []);
  const base = stored.length > 0 ? migrateWorkflows(stored) : initialWorkflows;
  // Ensure all initial workflows are present so the Examples canvas always has them
  const have = new Set(base.map((w) => w.id));
  const missing = initialWorkflows.filter((w) => !have.has(w.id));
  return missing.length > 0 ? [...base, ...missing] : base;
}

function initCanvases(): Canvas[] {
  const stored = readLocal<Canvas[]>(CANVAS_KEY, []);

  if (stored.length === 0) {
    // First run: empty My Business + populated read-only Examples
    return [{ ...myBusinessCanvas }, { ...examplesCanvas }];
  }

  // Existing user — keep their canvases, ensure Examples canvas exists and is read-only
  const out = [...stored];
  const idx = out.findIndex((c) => c.id === EXAMPLES_CANVAS_ID);
  if (idx === -1) {
    out.push({ ...examplesCanvas });
  } else if (!out[idx].readOnly) {
    out[idx] = { ...out[idx], readOnly: true };
  }
  return out;
}

export function useWorkflows() {
  const [workflows, setWorkflows] = useState<Workflow[]>(() => {
    const wfs = initWorkflows();
    return wfs;
  });

  const [canvases, setCanvases] = useState<Canvas[]>(() => initCanvases());

  const [activeCanvasId, setActiveCanvasId] = useState<string>(() => {
    const cvs = initCanvases();
    const stored = readLocal<string>(ACTIVE_KEY, "");
    if (cvs.find((c) => c.id === stored)) return stored;
    // Default to the user's editable canvas, not Examples
    const editable = cvs.find((c) => !c.readOnly);
    return editable?.id ?? cvs[0]?.id ?? DEFAULT_CANVAS_ID;
  });

  useEffect(() => {
    try { localStorage.setItem(WF_KEY, JSON.stringify(workflows)); } catch {}
  }, [workflows]);

  useEffect(() => {
    try { localStorage.setItem(CANVAS_KEY, JSON.stringify(canvases)); } catch {}
  }, [canvases]);

  useEffect(() => {
    try { localStorage.setItem(ACTIVE_KEY, activeCanvasId); } catch {}
  }, [activeCanvasId]);

  const activeCanvas = canvases.find((c) => c.id === activeCanvasId) ?? canvases[0];

  return { workflows, setWorkflows, canvases, setCanvases, activeCanvasId, setActiveCanvasId, activeCanvas };
}
