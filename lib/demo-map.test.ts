import { describe, it, expect } from "vitest";
import { waitsInside } from "./chaining";
import { rankWorkflows, formatPounds, HOURLY_RATE, FRICTIONS, DEMO_WORKFLOWS, DEPARTMENTS, LEAD_FRICTION, workflowBySlug } from "./demo-map";

describe("the demo's ranked workflows", () => {
  const ranked = rankWorkflows();

  it("puts the invoice check first, then month-end close, then contract review", () => {
    expect(ranked.map((w) => w.name)).toEqual([
      "Supplier invoice check",
      "Month-end close",
      "Supplier contract review",
    ]);
  });

  it("lands on the numbers the pitch reads out", () => {
    expect(ranked.map((w) => [w.hoursPerMonth, w.readiness, w.hoursBack])).toEqual([
      [42, 86, 36],
      [36, 55, 20],
      [12, 80, 10],
    ]);
  });

  it("prices time at the blended hourly rate", () => {
    expect(HOURLY_RATE).toBe(45);
    expect(ranked[0].costPerMonth).toBe(1890);
    expect(formatPounds(ranked[0].costPerMonth)).toBe("£1,890");
  });

  it("sends the invoice and contract workflows to their agents", () => {
    expect(ranked[0].agentHref).toBe("/agents?mode=invoices");
    expect(ranked.find((w) => w.name === "Supplier contract review")!.agentHref).toBe(
      "/agents?mode=contracts",
    );
  });
});

describe("the frictions an executive picks from", () => {
  it("covers every department, and leads with supplier invoices", () => {
    expect(new Set(FRICTIONS.map((f) => f.department))).toEqual(new Set(DEPARTMENTS));
    expect(FRICTIONS.find((f) => f.id === LEAD_FRICTION)?.workflowId).toBe("demo-invoice-check");
  });

  it("opens only workflows that exist, each once", () => {
    const wired = FRICTIONS.flatMap((f) => (f.workflowId ? [f.workflowId] : []));
    expect(new Set(wired).size).toBe(wired.length);
    for (const id of wired) expect(DEMO_WORKFLOWS.some((w) => w.id === id)).toBe(true);
  });
});

describe("the map's value hotspots", () => {
  it("sit on real steps, at most one to a step", () => {
    for (const w of DEMO_WORKFLOWS) {
      const steps = w.hotspots.map((h) => h.step);
      expect(new Set(steps).size).toBe(steps.length);
      for (const n of steps) expect(w.steps.some((s) => s.n === n)).toBe(true);
    }
  });

  it("each map has its own address", () => {
    expect(workflowBySlug("invoice-check")?.id).toBe("demo-invoice-check");
    expect(new Set(DEMO_WORKFLOWS.map((w) => w.slug)).size).toBe(DEMO_WORKFLOWS.length);
  });

  it("names the money on the agents' maps, and leaves counting it to the agent", () => {
    for (const w of DEMO_WORKFLOWS.filter((w) => w.agentHref)) {
      expect(w.hotspots.some((h) => h.kind === "money")).toBe(true);
      expect(w.teaser).toBeTruthy();
      expect(w.summary).not.toMatch(/£/);
    }
  });
});

describe("where a map splits into a chain", () => {
  it("every butterfly on the demo follows the rule: nothing waits part-way through one", () => {
    for (const w of DEMO_WORKFLOWS) {
      const parts = w.chain ?? [{ from: w.steps[0].n, to: w.steps.at(-1)!.n }];
      for (const part of parts) {
        const steps = w.steps.filter((s) => s.n >= part.from && s.n <= part.to);
        expect(waitsInside(steps), `${w.name}, steps ${part.from}-${part.to}`).toEqual([]);
      }
    }
  });

  it("month-end is two butterflies because the close waits on receipts", () => {
    const close = DEMO_WORKFLOWS.find((w) => w.id === "demo-month-end-close")!;
    expect(waitsInside(close.steps)[0].afterStep).toBe(3);
    expect(close.chain!.map((p) => [p.from, p.to, p.enteredFrom?.label])).toEqual([
      [1, 3, undefined],
      [4, 10, "Waits for the receipts"],
    ]);
  });

  it("a chain covers every step once, in order", () => {
    for (const w of DEMO_WORKFLOWS.filter((w) => w.chain)) {
      const covered = w.chain!.flatMap((p) => w.steps.filter((s) => s.n >= p.from && s.n <= p.to).map((s) => s.n));
      expect(covered).toEqual(w.steps.map((s) => s.n));
    }
  });
});

describe("outputs are the exits", () => {
  it("every card is entered from a real output of an earlier card, into a real input of its own", () => {
    for (const w of DEMO_WORKFLOWS.filter((w) => w.chain)) {
      w.chain!.forEach((part, index) => {
        if (!part.enteredFrom) return;
        const from = w.chain![part.enteredFrom.part];
        expect(part.enteredFrom.part).toBeLessThan(index);
        expect(from.outputs.map((o) => o.name), `${w.name}: ${part.name}`).toContain(part.enteredFrom.output);
        expect(part.inputs.map((i) => i.name), `${w.name}: ${part.name}`).toContain(part.enteredFrom.input);
      });
    }
  });

  it("a card with more than one way out says when each happens", () => {
    for (const w of DEMO_WORKFLOWS) {
      for (const card of w.chain ?? [w]) {
        if (card.outputs.length > 1 && w.chain) {
          for (const output of card.outputs) expect(output.when, `${w.name}: ${output.name}`).toBeTruthy();
        }
      }
    }
  });
});
