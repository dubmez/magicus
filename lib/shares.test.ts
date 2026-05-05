import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  generateShareToken,
  defaultRedactions,
  saveShare,
  getShare,
  incrementRemixCount,
  getSharesByWorkflowId,
  type ShareSettings,
} from "./shares";
import type { Workflow } from "./workflows";

// Stand-in localStorage for the node test environment. shares.ts checks
// `typeof window === 'undefined'` for SSR — we shim window + localStorage so
// the storage helpers exercise their full code paths.
const memoryStore: Record<string, string> = {};
const localStorageMock = {
  getItem: vi.fn((k: string) => (k in memoryStore ? memoryStore[k] : null)),
  setItem: vi.fn((k: string, v: string) => { memoryStore[k] = v; }),
  removeItem: vi.fn((k: string) => { delete memoryStore[k]; }),
  clear: vi.fn(() => { for (const k of Object.keys(memoryStore)) delete memoryStore[k]; }),
};

beforeEach(() => {
  Object.keys(memoryStore).forEach((k) => delete memoryStore[k]);
  // Stand up minimal window + localStorage globals so shares.ts's
  // typeof-window guard treats us as the browser.
  (globalThis as Record<string, unknown>).window =
    (globalThis as Record<string, unknown>).window ?? {};
  (globalThis as Record<string, unknown>).localStorage = localStorageMock;
});

function makeWorkflow(id = "wf-1"): Workflow {
  return {
    id,
    theme: "sales",
    name: "Test workflow",
    trigger: null,
    why: "",
    inputs: [],
    steps: [],
    outputs: [],
    tools: [],
    automationScore: 0,
    automationRationale: "",
    x: 0,
    y: 0,
  };
}

function makeSettings(overrides: Partial<ShareSettings> = {}): ShareSettings {
  return {
    token: "abc123",
    workflow: makeWorkflow(),
    sharedBy: { id: "u1", name: "Mez" },
    redactions: defaultRedactions(),
    publicLibrary: false,
    remixCount: 0,
    createdAt: 1700000000000,
    ...overrides,
  };
}

describe("generateShareToken", () => {
  it("returns a 10-character URL-safe token", () => {
    const t = generateShareToken();
    expect(t).toHaveLength(10);
    // crypto.randomUUID strips to hex chars; fallback uses base36. Both are
    // URL-safe.
    expect(t).toMatch(/^[a-z0-9]+$/i);
  });

  it("returns different tokens on subsequent calls", () => {
    const a = generateShareToken();
    const b = generateShareToken();
    expect(a).not.toBe(b);
  });
});

describe("defaultRedactions", () => {
  it("starts with everything visible", () => {
    const d = defaultRedactions();
    expect(d).toEqual({
      triggerDescription: false,
      purpose: false,
      tools: false,
      classifications: false,
      hiddenStepNumbers: [],
      hiddenInputIndices: [],
      hiddenOutputIndices: [],
    });
  });

  it("returns a fresh object each call so callers can mutate freely", () => {
    const a = defaultRedactions();
    const b = defaultRedactions();
    expect(a).not.toBe(b);
    expect(a.hiddenStepNumbers).not.toBe(b.hiddenStepNumbers);
  });
});

describe("saveShare / getShare", () => {
  it("round-trips a settings object through localStorage", () => {
    const s = makeSettings({ token: "abc" });
    saveShare(s);
    expect(getShare("abc")).toEqual(s);
  });

  it("returns null for an unknown token", () => {
    expect(getShare("nope")).toBeNull();
  });

  it("overwrites an existing entry with the same token", () => {
    saveShare(makeSettings({ token: "x", remixCount: 0 }));
    saveShare(makeSettings({ token: "x", remixCount: 5 }));
    expect(getShare("x")?.remixCount).toBe(5);
  });
});

describe("incrementRemixCount", () => {
  it("bumps the count by 1", () => {
    saveShare(makeSettings({ token: "t1", remixCount: 2 }));
    incrementRemixCount("t1");
    expect(getShare("t1")?.remixCount).toBe(3);
  });

  it("is a no-op for an unknown token", () => {
    expect(() => incrementRemixCount("missing")).not.toThrow();
    expect(getShare("missing")).toBeNull();
  });
});

describe("getSharesByWorkflowId", () => {
  it("returns every share for a given workflow id", () => {
    saveShare(makeSettings({ token: "t1", workflow: makeWorkflow("a") }));
    saveShare(makeSettings({ token: "t2", workflow: makeWorkflow("a") }));
    saveShare(makeSettings({ token: "t3", workflow: makeWorkflow("b") }));
    const found = getSharesByWorkflowId("a");
    expect(found).toHaveLength(2);
    expect(found.map((s) => s.token).sort()).toEqual(["t1", "t2"]);
  });

  it("returns an empty array when no shares match", () => {
    expect(getSharesByWorkflowId("never-shared")).toEqual([]);
  });
});
