import { describe, it, expect } from "vitest";
import { workflowToMarkdown, allWorkflowsToMarkdown } from "./markdown";
import type { Workflow } from "./workflows";

function workflow(overrides: Partial<Workflow> = {}): Workflow {
  return {
    id: "test",
    theme: "sales",
    name: "Test workflow",
    trigger: { type: "event", description: "On webhook" },
    why: "Process incoming events",
    inputs: [{ name: "Event", source: "Stripe" }],
    steps: [
      { n: 1, text: "Receive event", classification: "automate" },
      { n: 2, text: "Notify team", note: "Only if amount > $500", owner: "Ops", classification: "human_review" },
    ],
    outputs: [{ name: "Notification", source: "Slack" }],
    tools: ["Stripe", "Slack"],
    automationScore: 75,
    automationRationale: "Most steps are mechanical",
    x: 0,
    y: 0,
    ...overrides,
  };
}

describe("workflowToMarkdown", () => {
  it("renders the workflow name as an H1", () => {
    const md = workflowToMarkdown(workflow({ name: "Refund flow" }));
    expect(md).toMatch(/^# Refund flow/);
  });

  it("includes inputs, outputs, and tools sections", () => {
    const md = workflowToMarkdown(workflow());
    expect(md).toContain("## Inputs");
    expect(md).toContain("## Outputs");
    expect(md).toContain("## Tools");
    expect(md).toContain("**Event**");
    expect(md).toContain("`Stripe`");
  });

  it("preserves step notes and owner inline", () => {
    const md = workflowToMarkdown(workflow());
    expect(md).toContain("> _Only if amount > $500_");
    expect(md).toContain("> Owner: Ops");
  });

  it("formats the trigger label using the trigger type and description", () => {
    expect(workflowToMarkdown(workflow())).toContain("Event — On webhook");
  });

  it("falls back to 'Not yet defined' when trigger is null", () => {
    expect(workflowToMarkdown(workflow({ trigger: null }))).toContain("Not yet defined");
  });

  it("uses 'Triggered by an upstream workflow' for chained triggers", () => {
    expect(
      workflowToMarkdown(workflow({ trigger: { type: "chained" } }))
    ).toContain("Triggered by an upstream workflow");
  });

  it("includes the automation score and rationale", () => {
    const md = workflowToMarkdown(workflow({ automationScore: 88, automationRationale: "Mostly automated" }));
    expect(md).toContain("**88%**");
    expect(md).toContain("Mostly automated");
  });
});

describe("allWorkflowsToMarkdown", () => {
  it("includes a count and renders each workflow separated by '---'", () => {
    const md = allWorkflowsToMarkdown([
      workflow({ id: "a", name: "First" }),
      workflow({ id: "b", name: "Second" }),
    ]);
    expect(md).toContain("2 workflows mapped.");
    expect(md).toContain("First");
    expect(md).toContain("Second");
    // Three '---' separators total: one after the count, one between
    // workflows, plus one inside each workflow's automation prompt.
    expect((md.match(/^---$/gm) ?? []).length).toBeGreaterThanOrEqual(3);
  });

  it("handles an empty list gracefully", () => {
    const md = allWorkflowsToMarkdown([]);
    expect(md).toContain("0 workflows mapped.");
  });
});
