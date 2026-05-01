"use client";

import { useState, useEffect } from "react";
import { initialWorkflows, initialCanvas, type Workflow, type Canvas } from "./workflows";

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
    const legacy = w as Workflow & { tasks?: unknown };
    if (legacy.tasks && !w.steps) {
      const { tasks, ...rest } = legacy;
      return { ...rest, steps: tasks } as Workflow;
    }
    return w;
  });
}

function initWorkflows(): Workflow[] {
  const stored = readLocal<Workflow[]>(WF_KEY, []);
  if (stored.length > 0) return migrateWorkflows(stored);
  return initialWorkflows;
}

function initCanvases(wfs: Workflow[]): Canvas[] {
  const stored = readLocal<Canvas[]>(CANVAS_KEY, []);
  if (stored.length > 0) return stored;
  // First run or migration from old flat format
  const oldConns = readLocal<Canvas["connections"]>("magicus:connections", []);
  return [
    {
      ...initialCanvas,
      workflowIds: wfs.map((w) => w.id),
      connections: oldConns.length > 0 ? oldConns : initialCanvas.connections,
    },
  ];
}

export function useWorkflows() {
  const [workflows, setWorkflows] = useState<Workflow[]>(() => {
    const wfs = initWorkflows();
    return wfs;
  });

  const [canvases, setCanvases] = useState<Canvas[]>(() => {
    const wfs = initWorkflows();
    return initCanvases(wfs);
  });

  const [activeCanvasId, setActiveCanvasId] = useState<string>(() => {
    const cvs = initCanvases(initWorkflows());
    const stored = readLocal<string>(ACTIVE_KEY, "");
    return cvs.find((c) => c.id === stored) ? stored : (cvs[0]?.id ?? "");
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
