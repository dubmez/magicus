// The finance demo's Act 1: three workflows found in a capture, ranked by the
// hours automating each would give back. Readiness is magicus's own step score,
// so the numbers on the ranked list are the same ones the map shows.
//
// Hours and cost only. Money at stake belongs to the agent that checks the
// documents (Act 2); this screen is about where the team's time goes.

import { calculateAutomationScore, type Workflow } from "@/lib/workflows";

/** Blended hourly cost of the people doing this work, in pounds. */
export const HOURLY_RATE = 45;

/** The pre-recorded capture shown before the map. Swap the file, keep the path. */
export const CAPTURE_VIDEO_SRC = "/demo/capture.mp4";

/** How long the "watching the capture" animation runs before the list appears. */
export const PROCESSING_MS = 4200;

export const PROCESSING_MESSAGES = [
  "Watching the capture...",
  "Finding the steps...",
  "Scoring readiness...",
];

export type DemoWorkflow = Workflow & {
  owner: string;
  hoursPerMonth: number;
  /** Where the CTA goes, or null for a workflow with no agent in this demo. */
  agentHref: string | null;
  /** Why this one first, shown only on the top-ranked card. */
  reason?: string;
};

export type RankedWorkflow = DemoWorkflow & {
  readiness: number;
  costPerMonth: number;
  hoursBack: number;
};

const base = (i: number) => ({
  x: i * 800,
  y: 400 + (i % 2 ? 120 : 0),
});

export const DEMO_WORKFLOWS: DemoWorkflow[] = [
  {
    ...base(0),
    id: "demo-invoice-check",
    theme: "finance",
    trigger: { type: "event", description: "A supplier invoice arrives by email" },
    name: "Supplier invoice check",
    owner: "Finance manager",
    hoursPerMonth: 42,
    agentHref: "/agents?mode=invoices",
    reason: "Most hours back, and the rules already live in your rate cards.",
    why: "Every supplier invoice is checked by eye against the rate card before it is paid.",
    inputs: [
      { name: "Supplier invoice", source: "Gmail" },
      { name: "Rate card", source: "Google Drive" },
    ],
    steps: [
      { n: 1, text: "Open the emailed invoice", owner: "Finance manager", automationPotential: "high" },
      { n: 2, text: "Download the PDF and save it to the supplier folder", owner: "Finance manager", automationPotential: "high" },
      {
        n: 3,
        text: "Find the right rate card in Google Drive",
        owner: "Finance manager",
        automationPotential: "high",
        note: "Always have to dig out last April's rate card for this supplier.",
      },
      {
        n: 4,
        text: "Check which card version applies to the billing period",
        owner: "Finance manager",
        automationPotential: "high",
        note: "Cards change mid-year and nobody tells accounts payable.",
      },
      {
        n: 5,
        text: "Check each line against the rate card by eye",
        owner: "Finance manager",
        automationPotential: "high",
        note: "Forty lines an invoice. By Friday it is a skim.",
      },
      { n: 6, text: "Note any discrepancy in the tracker", owner: "Finance manager", automationPotential: "medium" },
      {
        n: 7,
        text: "Flag it to a colleague in Slack",
        owner: "Finance manager",
        automationPotential: "medium",
        note: "Half of these never get chased once the invoice is paid.",
      },
    ],
    outputs: [
      { name: "Approved invoice", source: "Accounts payable" },
      { name: "Query to supplier", source: "Slack" },
    ],
    tools: ["Gmail", "Google Drive", "Google Sheets", "Slack"],
    automationScore: 0,
    automationRationale: "Every check is a rule already written down in a rate card.",
  },
  {
    ...base(1),
    id: "demo-month-end-close",
    theme: "finance",
    trigger: { type: "schedule", description: "First working day of the month" },
    name: "Month-end close",
    owner: "Financial controller",
    hoursPerMonth: 36,
    agentHref: null,
    why: "Closing the books each month, from bank reconciliation to the management pack.",
    inputs: [
      { name: "Bank statements", source: "Bank portal" },
      { name: "Ledger", source: "Accounting system" },
    ],
    steps: [
      { n: 1, text: "Export bank statements", owner: "Financial controller", automationPotential: "high" },
      { n: 2, text: "Reconcile bank to ledger", owner: "Financial controller", automationPotential: "medium" },
      { n: 3, text: "Chase missing receipts", owner: "Financial controller", automationPotential: "medium" },
      { n: 4, text: "Post accruals and prepayments", owner: "Financial controller", automationPotential: "medium" },
      { n: 5, text: "Review aged payables", owner: "Financial controller", automationPotential: "high" },
      {
        n: 6,
        text: "Judge provisions with the finance director",
        owner: "Financial controller",
        automationPotential: "low",
        note: "Needs judgement, and a conversation.",
      },
      { n: 7, text: "Reconcile intercompany balances", owner: "Financial controller", automationPotential: "medium" },
      { n: 8, text: "Run the trial balance", owner: "Financial controller", automationPotential: "high" },
      { n: 9, text: "Write the variance commentary", owner: "Financial controller", automationPotential: "medium" },
      { n: 10, text: "Sign off the management pack", owner: "Financial controller", automationPotential: "low" },
    ],
    outputs: [{ name: "Management pack", source: "Board" }],
    tools: ["Bank portal", "Accounting system", "Excel", "Email"],
    automationScore: 0,
    automationRationale: "Much of it is mechanical, but the judgement calls stay with people.",
  },
  {
    ...base(2),
    id: "demo-contract-review",
    theme: "operations",
    trigger: { type: "event", description: "A contract arrives for signature or renewal" },
    name: "Supplier contract review",
    owner: "Head of ops + legal",
    hoursPerMonth: 12,
    agentHref: "/agents?mode=contracts",
    why: "Reading supplier contracts against the positions the business holds before signing or renewing.",
    inputs: [
      { name: "Supplier contract", source: "Email" },
      { name: "Negotiation playbook", source: "Google Drive" },
    ],
    steps: [
      { n: 1, text: "Open the contract from the supplier's email", owner: "Head of ops", automationPotential: "high" },
      { n: 2, text: "Find the playbook position for each clause", owner: "Legal", automationPotential: "high" },
      {
        n: 3,
        text: "Mark clauses that fall outside the playbook",
        owner: "Legal",
        automationPotential: "high",
        note: "Price review clauses are the ones that bite at renewal.",
      },
      { n: 4, text: "Draft fallback wording for each one", owner: "Legal", automationPotential: "medium" },
      { n: 5, text: "Agree the redlines with the supplier", owner: "Head of ops", automationPotential: "medium" },
    ],
    outputs: [{ name: "Redlined contract", source: "Email" }],
    tools: ["Email", "Google Drive", "Word"],
    automationScore: 0,
    automationRationale: "The playbook is a set of rules; the negotiation is not.",
  },
];

export function rankWorkflows(workflows: DemoWorkflow[] = DEMO_WORKFLOWS): RankedWorkflow[] {
  return workflows
    .map((w) => {
      const readiness = calculateAutomationScore(w.steps);
      return {
        ...w,
        automationScore: readiness,
        readiness,
        costPerMonth: w.hoursPerMonth * HOURLY_RATE,
        hoursBack: Math.round((w.hoursPerMonth * readiness) / 100),
      };
    })
    .sort((a, b) => b.hoursBack - a.hoursBack);
}

export function formatPounds(pounds: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(pounds);
}
