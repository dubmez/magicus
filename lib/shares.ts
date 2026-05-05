"use client";

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

const SHARES_KEY = "magicus:shares";

type ShareMap = Record<string, ShareSettings>;

function readMap(): ShareMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(SHARES_KEY);
    return raw ? (JSON.parse(raw) as ShareMap) : {};
  } catch {
    return {};
  }
}

function writeMap(map: ShareMap) {
  try { localStorage.setItem(SHARES_KEY, JSON.stringify(map)); } catch {}
}

// URL-safe 10-char token. crypto.randomUUID() is widely available; we strip
// the hyphens and take the first 10 chars for a compact share link.
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

export function saveShare(settings: ShareSettings): void {
  const map = readMap();
  map[settings.token] = settings;
  writeMap(map);
}

export function getShare(token: string): ShareSettings | null {
  const map = readMap();
  return map[token] ?? null;
}

export function incrementRemixCount(token: string): void {
  const map = readMap();
  if (map[token]) {
    map[token] = { ...map[token], remixCount: map[token].remixCount + 1 };
    writeMap(map);
  }
}

// All shares the current sharer has created — used to look up remixCount for
// a given workflow (if there's a share for it).
export function getSharesByWorkflowId(workflowId: string): ShareSettings[] {
  const map = readMap();
  return Object.values(map).filter((s) => s.workflow.id === workflowId);
}
