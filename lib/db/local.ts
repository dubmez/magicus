import type { Workflow, Canvas, ShareSettings } from "./types";
import type { Storage } from "./storage";

// localStorage-backed implementation of the Storage interface. Methods are
// async by contract (matching the interface) but resolve synchronously since
// localStorage is a sync API. Phase 3's Supabase impl plugs in here without
// any UI refactor.
//
// Sync read helpers (readWorkflowsSync, readCanvasesSync, ...) are exported
// separately so hooks like useWorkflows can hydrate state instantly in a
// useState initializer. These are NOT part of the Storage interface — they
// are an explicit escape hatch tied to localStorage. When Supabase ships
// we'll migrate hooks to Suspense or loading skeletons instead.

const WF_KEY = "magicus:workflows";
const CANVAS_KEY = "magicus:canvases";
const ACTIVE_KEY = "magicus:active-canvas";
const SHARES_KEY = "magicus:shares";

// ─── Generic helpers ──────────────────────────────────────────────────────

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota exceeded or storage disabled — drop the write */
  }
}

function readString(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeString(key: string, value: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, value);
  } catch {
    /* see writeJson */
  }
}

// ─── Sync escape hatches (for useState initializers only) ─────────────────

export function readWorkflowsSync(): Workflow[] {
  return readJson<Workflow[]>(WF_KEY, []);
}

export function readCanvasesSync(): Canvas[] {
  return readJson<Canvas[]>(CANVAS_KEY, []);
}

export function readActiveCanvasIdSync(): string | null {
  return readString(ACTIVE_KEY);
}

// ─── Storage impl ─────────────────────────────────────────────────────────

type ShareMap = Record<string, ShareSettings>;

function readShareMap(): ShareMap {
  return readJson<ShareMap>(SHARES_KEY, {});
}

function writeShareMap(map: ShareMap): void {
  writeJson(SHARES_KEY, map);
}

export const localStorageBackend: Storage = {
  async loadWorkflows() {
    return readWorkflowsSync();
  },
  async saveWorkflows(workflows) {
    writeJson(WF_KEY, workflows);
  },

  async loadCanvases() {
    return readCanvasesSync();
  },
  async saveCanvases(canvases) {
    writeJson(CANVAS_KEY, canvases);
  },

  async loadActiveCanvasId() {
    return readActiveCanvasIdSync();
  },
  async saveActiveCanvasId(id) {
    writeString(ACTIVE_KEY, id);
  },

  async loadShare(token) {
    return readShareMap()[token] ?? null;
  },

  async loadSharesByWorkflowId(workflowId) {
    return Object.values(readShareMap()).filter(
      (s) => s.workflow.id === workflowId
    );
  },

  async saveShare(settings) {
    const map = readShareMap();
    map[settings.token] = settings;
    writeShareMap(map);
  },

  async incrementRemixCount(token) {
    const map = readShareMap();
    if (map[token]) {
      map[token] = { ...map[token], remixCount: map[token].remixCount + 1 };
      writeShareMap(map);
    }
  },
};
