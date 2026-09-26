// The demo's first two steps. It opens on the frictions an executive would name,
// department by department; picking one opens its map, with the places value sits
// marked on the steps. Readiness is magicus's own step score, so the ranked list
// and the map agree.
//
// Money is named here but never counted: the figure belongs to the agent that
// reads the documents, so the map says where it leaks and the agent says how much.

import { calculateAutomationScore, type IOItem, type Trigger, type Workflow } from "@/lib/workflows";

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

/** Where value sits on a step: hours spent, money leaking, or a risk taken. */
export type HotspotKind = "time" | "money" | "risk";

export type Hotspot = { step: number; kind: HotspotKind; label: string };

export const HOTSPOT_META: Record<HotspotKind, { label: string; fg: string; bg: string }> = {
  time: { label: "Time", fg: "#547863", bg: "#EBF4DD" },
  money: { label: "Money leaking", fg: "#C2412D", bg: "#FDEBE7" },
  risk: { label: "Risk", fg: "#9A6414", bg: "#FBF1DC" },
};

/**
 * One butterfly of a chain. The rule for where a chain splits is in lib/chaining.ts:
 * split where the work waits. Steps keep their numbers across the chain, so a value
 * hotspot on step 7 means the same step whichever butterfly it sits in.
 */
export type ChainPart = {
  name: string;
  trigger: Trigger;
  /** First and last step numbers, inclusive. */
  from: number;
  to: number;
  inputs: IOItem[];
  outputs: IOItem[];
  tools: string[];
  /** The event that starts the next butterfly, shown on the connection. */
  handoff?: string;
};

export type DemoWorkflow = Workflow & {
  /** Set when the work waits part-way, so the map is a chain of butterflies. */
  chain?: ChainPart[];
  /** The map's address: /map/<slug>. */
  slug: string;
  /** Where value sits, step by step. */
  hotspots: Hotspot[];
  /** One line above the map, in the executive's terms. */
  summary: string;
  /** What the agent will add, so the payoff is still ahead. Null with no agent. */
  teaser: string | null;
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
    slug: "invoice-check",
    summary: "About 36 hours a month back, and money you are overpaying that nobody checks.",
    teaser: "The agent will tell you how much.",
    hotspots: [
      { step: 2, kind: "time", label: "Filing every invoice by hand" },
      { step: 4, kind: "money", label: "Old rates keep being billed after a card changes" },
      { step: 5, kind: "money", label: "Forty lines by eye, so overcharges get paid" },
      { step: 7, kind: "risk", label: "Queries go unchased until the dispute window closes" },
    ],
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
    slug: "month-end-close",
    summary: "About 20 hours a month back, and a close that stops slipping.",
    teaser: null,
    hotspots: [
      { step: 2, kind: "time", label: "Matching bank lines by hand" },
      { step: 3, kind: "time", label: "Chasing receipts by email" },
      { step: 7, kind: "risk", label: "Intercompany differences found late" },
      { step: 9, kind: "time", label: "Commentary written from scratch every month" },
    ],
    theme: "finance",
    trigger: { type: "schedule", description: "First working day of the month" },
    name: "Month-end close",
    owner: "Financial controller",
    hoursPerMonth: 36,
    agentHref: null,
    why: "Closing the books each month, from bank reconciliation to the management pack.",
    // The close waits on other people's receipts, so it is two butterflies, not one.
    chain: [
      {
        name: "Reconcile the month",
        trigger: { type: "schedule", description: "First working day of the month" },
        from: 1,
        to: 3,
        inputs: [
          { name: "Bank statements", source: "Bank portal" },
          { name: "Ledger", source: "Accounting system" },
        ],
        outputs: [{ name: "Receipt requests", source: "Email" }],
        tools: ["Bank portal", "Accounting system", "Email"],
        handoff: "Receipts in",
      },
      {
        name: "Close and report",
        trigger: { type: "chained" },
        from: 4,
        to: 10,
        inputs: [
          { name: "Receipts", source: "Email" },
          { name: "Reconciled ledger", source: "Accounting system" },
        ],
        outputs: [{ name: "Management pack", source: "Board" }],
        tools: ["Accounting system", "Excel"],
      },
    ],
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
    slug: "contract-review",
    summary: "About 10 hours a month back, and renewals that stop drifting against you.",
    teaser: "The agent will show you which clauses.",
    hotspots: [
      { step: 2, kind: "time", label: "Looking up the playbook clause by clause" },
      { step: 3, kind: "money", label: "Price review clauses slip through and bite at renewal" },
      { step: 4, kind: "risk", label: "Fallback wording drafted from memory" },
    ],
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
      { n: 5, text: "Send the redlines to the supplier", owner: "Head of ops", automationPotential: "medium" },
    ],
    outputs: [{ name: "Redlined contract", source: "Email" }],
    tools: ["Email", "Google Drive", "Word"],
    automationScore: 0,
    automationRationale: "The playbook is a set of rules; the negotiation is not.",
  },
];

/** A friction, in the words an executive would use, and the workflow behind it if we have mapped one. */
export type Friction = {
  id: string;
  department: Department;
  text: string;
  /** What it costs, in a phrase. Figures only where the map carries them. */
  cost: string;
  /** The mapped workflow it opens, or absent: that one is mapped in the audit. */
  workflowId?: string;
};

export const DEPARTMENTS = ["Finance", "Operations", "Sales", "People", "Customer service"] as const;
export type Department = (typeof DEPARTMENTS)[number];

/** The friction the demo leads with. */
export const LEAD_FRICTION = "supplier-invoices";

export const FRICTIONS: Friction[] = [
  {
    id: "supplier-invoices",
    department: "Finance",
    text: "Supplier invoices get paid without being checked.",
    cost: "42 hours a month by eye, and overcharges still get through.",
    workflowId: "demo-invoice-check",
  },
  {
    id: "month-end",
    department: "Finance",
    text: "Month-end takes a week.",
    cost: "36 hours a month closing the books.",
    workflowId: "demo-month-end-close",
  },
  { id: "late-payers", department: "Finance", text: "Customers pay late and nobody chases.", cost: "Cash sits in other people's accounts." },
  {
    id: "contract-renewals",
    department: "Operations",
    text: "Supplier contracts renew on bad terms.",
    cost: "12 hours a month, and price reviews that bite at renewal.",
    workflowId: "demo-contract-review",
  },
  { id: "stock-counts", department: "Operations", text: "Stock counts never match the system.", cost: "Write-offs nobody can explain." },
  { id: "quotes", department: "Sales", text: "Quotes take days to go out.", cost: "Deals cool while pricing is checked." },
  { id: "crm", department: "Sales", text: "The CRM is always out of date.", cost: "Forecasts built on guesswork." },
  { id: "onboarding", department: "People", text: "New starters wait a week for kit and access.", cost: "A lost first week, every hire." },
  { id: "timesheets", department: "People", text: "Overtime and holiday get keyed in twice.", cost: "Payroll errors, then corrections." },
  { id: "repeat-questions", department: "Customer service", text: "The same questions come in every day.", cost: "The team answers instead of solving." },
  { id: "refunds", department: "Customer service", text: "Refunds need three approvals.", cost: "Unhappy customers wait for days." },
];

export function workflowBySlug(slug: string): DemoWorkflow | undefined {
  return DEMO_WORKFLOWS.find((w) => w.slug === slug);
}

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
