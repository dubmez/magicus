import { describe, it, expect } from "vitest";
import {
  calculateAutomationScore,
  computeChains,
  chainKey,
  inferChainName,
  POTENTIAL_META,
  SENSITIVE_META,
  type Step,
  type Workflow,
  type Connection,
  type AutomationPotential,
} from "./workflows";

// Helper: a Step with sensible defaults so tests can override only the field
// under test.
function step(
  n: number,
  automationPotential?: AutomationPotential,
  text = ""
): Step {
  return { n, text: text || `Step ${n}`, automationPotential };
}

// Helper: a minimal Workflow used by chain-naming tests.
function wf(id: string, name: string, x: number, theme: Workflow["theme"] = "sales"): Workflow {
  return {
    id,
    theme,
    name,
    trigger: null,
    why: "",
    inputs: [],
    steps: [],
    outputs: [],
    tools: [],
    automationScore: 0,
    automationRationale: "",
    x,
    y: 0,
  };
}

describe("calculateAutomationScore", () => {
  it("returns 0 when no steps have a potential set", () => {
    expect(calculateAutomationScore([])).toBe(0);
    expect(calculateAutomationScore([step(1), step(2)])).toBe(0);
  });

  it("returns 100 when every step is high potential", () => {
    expect(
      calculateAutomationScore([
        step(1, "high"),
        step(2, "high"),
        step(3, "high"),
      ])
    ).toBe(100);
  });

  it("returns 0 when every step is low potential", () => {
    expect(
      calculateAutomationScore([step(1, "low"), step(2, "low")])
    ).toBe(0);
  });

  it("uses the spec'd weighted average (100/50/0)", () => {
    // high=100 + medium=50 = 150 / 2 = 75
    expect(
      calculateAutomationScore([step(1, "high"), step(2, "medium")])
    ).toBe(75);
    // high=100 + low=0 = 100 / 2 = 50
    expect(
      calculateAutomationScore([step(1, "high"), step(2, "low")])
    ).toBe(50);
  });

  it("excludes unscored steps from the average rather than treating them as 0", () => {
    // 1 high among 3 steps; only the scored one counts → 100
    expect(
      calculateAutomationScore([step(1, "high"), step(2), step(3)])
    ).toBe(100);
  });

  it("ignores isSensitive when computing the score", () => {
    // Sensitive flag is orthogonal — it must not affect the automation score.
    const a: Step = { n: 1, text: "a", automationPotential: "high" };
    const b: Step = {
      n: 2,
      text: "b",
      automationPotential: "high",
      isSensitive: true,
    };
    expect(calculateAutomationScore([a, b])).toBe(100);
  });

  it("rounds to the nearest integer", () => {
    // 50 + 50 + 100 = 200 / 3 = 66.666… → rounds to 67
    expect(
      calculateAutomationScore([
        step(1, "medium"),
        step(2, "medium"),
        step(3, "high"),
      ])
    ).toBe(67);
  });
});

describe("chainKey", () => {
  it("sorts ids before joining so order doesn't matter", () => {
    expect(chainKey(["b", "a", "c"])).toBe("a|b|c");
    expect(chainKey(["c", "b", "a"])).toBe(chainKey(["a", "b", "c"]));
  });

  it("handles a single id", () => {
    expect(chainKey(["solo"])).toBe("solo");
  });

  it("handles empty input", () => {
    expect(chainKey([])).toBe("");
  });
});

describe("computeChains", () => {
  it("returns one chain per disconnected workflow when there are no connections", () => {
    const chains = computeChains(["a", "b", "c"], []);
    expect(chains).toHaveLength(3);
    expect(chains.flat().sort()).toEqual(["a", "b", "c"]);
  });

  it("groups workflows connected by an edge into one chain", () => {
    const conns: Connection[] = [
      { from: "a", to: "b" },
      { from: "b", to: "c" },
    ];
    const chains = computeChains(["a", "b", "c"], conns);
    expect(chains).toHaveLength(1);
    expect(chains[0].sort()).toEqual(["a", "b", "c"]);
  });

  it("treats edges as undirected for grouping", () => {
    // a→b and c→b — all three should end up in the same chain
    const conns: Connection[] = [
      { from: "a", to: "b" },
      { from: "c", to: "b" },
    ];
    const chains = computeChains(["a", "b", "c"], conns);
    expect(chains).toHaveLength(1);
    expect(chains[0].sort()).toEqual(["a", "b", "c"]);
  });

  it("ignores edges that point at workflows not in the input set", () => {
    // Connection references a phantom 'z' that's not in workflowIds
    const conns: Connection[] = [
      { from: "a", to: "z" },
      { from: "b", to: "c" },
    ];
    const chains = computeChains(["a", "b", "c"], conns);
    // a is alone (its edge goes nowhere); b and c are grouped
    const sorted = chains.map((c) => c.sort());
    sorted.sort((x, y) => x.length - y.length);
    expect(sorted).toEqual([["a"], ["b", "c"]]);
  });

  it("returns multiple disjoint chains when components are separate", () => {
    const conns: Connection[] = [
      { from: "a", to: "b" },
      { from: "c", to: "d" },
    ];
    const chains = computeChains(["a", "b", "c", "d"], conns);
    expect(chains).toHaveLength(2);
    const sorted = chains.map((c) => c.sort());
    sorted.sort((x, y) => x[0].localeCompare(y[0]));
    expect(sorted).toEqual([
      ["a", "b"],
      ["c", "d"],
    ]);
  });
});

describe("inferChainName", () => {
  it("returns 'Unnamed' for an empty chain", () => {
    expect(inferChainName([])).toBe("Unnamed");
  });

  it("returns the workflow's own name for a chain of one", () => {
    expect(inferChainName([wf("a", "Solo workflow", 0)])).toBe("Solo workflow");
  });

  it("strips trailing phase words and appends the theme suffix", () => {
    // 'flow' is one of PHASE_WORDS; sales theme → ' conversion' suffix
    const a = wf("a", "Lead capture flow", 0, "sales");
    const b = wf("b", "Onboarding", 800, "sales");
    expect(inferChainName([a, b])).toBe("Lead capture conversion");
  });

  it("uses the leftmost workflow (lowest x) as the chain root", () => {
    // 'b' is at x=0 so it should win, not the alphabetically-first 'a'
    const a = wf("a", "Right side", 1000);
    const b = wf("b", "Leftmost workflow", 0);
    expect(inferChainName([a, b]).startsWith("Leftmost")).toBe(true);
  });
});

describe("POTENTIAL_META", () => {
  it("covers every automation-potential tier", () => {
    const expected: AutomationPotential[] = ["high", "medium", "low"];
    for (const p of expected) {
      expect(POTENTIAL_META[p]).toBeDefined();
      expect(POTENTIAL_META[p].label).toBeTruthy();
      expect(POTENTIAL_META[p].description).toBeTruthy();
      expect(POTENTIAL_META[p].bg).toMatch(/^#[0-9A-F]{6}$/i);
      expect(POTENTIAL_META[p].fg).toMatch(/^#[0-9A-F]{6}$/i);
      expect(POTENTIAL_META[p].dot).toMatch(/^#[0-9A-F]{6}$/i);
    }
  });

  it("uses distinct backgrounds for each tier", () => {
    expect(POTENTIAL_META.high.bg).not.toBe(POTENTIAL_META.medium.bg);
    expect(POTENTIAL_META.medium.bg).not.toBe(POTENTIAL_META.low.bg);
    expect(POTENTIAL_META.high.bg).not.toBe(POTENTIAL_META.low.bg);
  });
});

describe("SENSITIVE_META", () => {
  it("provides label, description, and palette colours", () => {
    expect(SENSITIVE_META.label).toBeTruthy();
    expect(SENSITIVE_META.description).toBeTruthy();
    expect(SENSITIVE_META.fg).toMatch(/^#[0-9A-F]{6}$/i);
    expect(SENSITIVE_META.dot).toMatch(/^#[0-9A-F]{6}$/i);
  });
});
