import { describe, it, expect } from "vitest";
import { rankWorkflows, formatPounds, HOURLY_RATE } from "./demo-map";

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
