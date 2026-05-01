export type Theme = "sales" | "marketing" | "operations" | "finance";

export type IOItem = { name: string; source: string };

export type Step = { n: number; text: string; note?: string; owner?: string };

export type Trigger = {
  type: "schedule" | "event" | "manual" | "chained";
  description?: string;
};

export type Workflow = {
  id: string;
  theme: Theme;
  name: string;
  trigger: Trigger | null;
  why: string;
  inputs: IOItem[];
  steps: Step[];
  outputs: IOItem[];
  tools: string[];
  automationScore: number;
  automationRationale: string;
  x: number;
  y: number;
};

export type Connection = { from: string; to: string; label?: string };

export type Canvas = {
  id: string;
  name: string;
  workflowIds: string[];
  connections: Connection[];
  chainNames: Record<string, string>;
  readOnly?: boolean;
};

export const EXAMPLES_CANVAS_ID = "canvas-examples";
export const DEFAULT_CANVAS_ID = "canvas-default";

// ─── Chain utilities ──────────────────────────────────────────────────────────

export function computeChains(workflowIds: string[], connections: Connection[]): string[][] {
  const adj = new Map<string, Set<string>>();
  for (const id of workflowIds) adj.set(id, new Set());
  for (const c of connections) {
    if (adj.has(c.from) && adj.has(c.to)) {
      adj.get(c.from)!.add(c.to);
      adj.get(c.to)!.add(c.from);
    }
  }
  const visited = new Set<string>();
  const chains: string[][] = [];
  for (const id of workflowIds) {
    if (visited.has(id)) continue;
    const component: string[] = [];
    const queue = [id];
    while (queue.length > 0) {
      const cur = queue.shift()!;
      if (visited.has(cur)) continue;
      visited.add(cur);
      component.push(cur);
      for (const nb of (adj.get(cur) ?? [])) {
        if (!visited.has(nb)) queue.push(nb);
      }
    }
    chains.push(component);
  }
  return chains;
}

export function chainKey(ids: string[]): string {
  return [...ids].sort().join("|");
}

const PHASE_WORDS =
  /\s+(qualif\w+|process\w+|review\w+|approv\w+|screen\w+|handl\w+|manag\w+|track\w+|call|send|publish\w*|pipeline|workflow|flow)$/i;
const CHAIN_SUFFIXES: Record<Theme, string> = {
  sales: "conversion",
  marketing: "campaign",
  operations: "process",
  finance: "cycle",
};

export function inferChainName(workflows: Workflow[]): string {
  if (workflows.length === 0) return "Unnamed";
  if (workflows.length === 1) return workflows[0].name;
  const sorted = [...workflows].sort((a, b) => a.x - b.x);
  const base = sorted[0].name.replace(PHASE_WORDS, "").trim();
  return `${base} ${CHAIN_SUFFIXES[sorted[0].theme]}`;
}

// ─── Theme metadata ───────────────────────────────────────────────────────────

export const THEME_META: Record<Theme, { label: string; dot: string }> = {
  sales: { label: "Sales", dot: "#547863" },
  marketing: { label: "Marketing", dot: "#C99461" },
  operations: { label: "Operations", dot: "#6B8AB8" },
  finance: { label: "Finance", dot: "#B5894C" },
};

// ─── Seed data ────────────────────────────────────────────────────────────────

export const initialWorkflows: Workflow[] = [
  {
    id: "qual",
    theme: "sales",
    name: "Inbound lead qualification",
    trigger: { type: "event", description: "New lead form submitted on the website" },
    why: "Surface high-fit leads quickly so reps spend time on the right accounts.",
    inputs: [
      { name: "Lead form data", source: "Website" },
      { name: "ICP criteria", source: "Notion" },
    ],
    steps: [
      { n: 1, text: "Receive inbound lead" },
      { n: 2, text: "Score against ICP", note: "If score > 7, proceed", owner: "Rev Ops" },
      { n: 3, text: "Send personalised outreach", owner: "Sales lead" },
      { n: 4, text: "Log to CRM" },
    ],
    outputs: [
      { name: "Qualified lead record", source: "HubSpot" },
      { name: "Follow-up sent", source: "Gmail" },
    ],
    tools: ["HubSpot", "Gmail", "Notion"],
    automationScore: 78,
    automationRationale: "Scoring + outreach are rule-based; only edge cases need a human.",
    x: 0,
    y: 0,
  },
  {
    id: "discovery",
    theme: "sales",
    name: "Discovery & needs call",
    trigger: { type: "chained" },
    why: "Understand the prospect's pain before pitching to avoid wasted cycles.",
    inputs: [
      { name: "Qualified lead", source: "HubSpot" },
      { name: "Discovery script", source: "Notion" },
    ],
    steps: [
      { n: 1, text: "Schedule call" },
      { n: 2, text: "Run discovery", note: "If budget confirmed, advance", owner: "AE" },
      { n: 3, text: "Capture pain points" },
      { n: 4, text: "Update opportunity" },
    ],
    outputs: [
      { name: "Discovery notes", source: "HubSpot" },
      { name: "Call recording", source: "Gong" },
    ],
    tools: ["HubSpot", "Calendly", "Gong"],
    automationScore: 42,
    automationRationale: "Live conversation is human-led; only scheduling and logging are automatable.",
    x: 800,
    y: 120,
  },
  {
    id: "proposal",
    theme: "sales",
    name: "Proposal & pricing",
    trigger: { type: "chained" },
    why: "Send tailored proposals fast while keeping margin within guardrails.",
    inputs: [
      { name: "Discovery notes", source: "HubSpot" },
      { name: "Pricing matrix", source: "Sheets" },
    ],
    steps: [
      { n: 1, text: "Draft proposal" },
      { n: 2, text: "Internal review", note: "If discount > 15%, escalate", owner: "Solutions" },
      { n: 3, text: "Send to prospect" },
      { n: 4, text: "Track open + reply" },
    ],
    outputs: [
      { name: "Signed proposal link", source: "DocuSign" },
      { name: "Quote record", source: "HubSpot" },
    ],
    tools: ["DocuSign", "HubSpot", "Sheets"],
    automationScore: 64,
    automationRationale: "Drafting and routing automate well; pricing exceptions need a human.",
    x: 1600,
    y: 0,
  },
  {
    id: "close",
    theme: "sales",
    name: "Close & handoff",
    trigger: { type: "chained" },
    why: "Move customers from sales to success without dropped context.",
    inputs: [
      { name: "Signed proposal", source: "DocuSign" },
      { name: "Onboarding template", source: "Notion" },
    ],
    steps: [
      { n: 1, text: "Mark deal closed-won" },
      { n: 2, text: "Trigger invoice", note: "If annual, send PO request" },
      { n: 3, text: "Kick off onboarding", owner: "CSM" },
      { n: 4, text: "Schedule QBR" },
    ],
    outputs: [
      { name: "Customer record", source: "HubSpot" },
      { name: "Onboarding plan", source: "Notion" },
    ],
    tools: ["HubSpot", "Stripe", "Notion"],
    automationScore: 81,
    automationRationale: "Closed-won triggers, invoicing, and template kickoff are all rules-based.",
    x: 2400,
    y: 120,
  },
  {
    id: "newsletter",
    theme: "marketing",
    name: "Weekly newsletter send",
    trigger: { type: "schedule", description: "Every Thursday at 9am local" },
    why: "Keep audience engaged with consistent value-led touchpoints.",
    inputs: [
      { name: "Editorial calendar", source: "Notion" },
      { name: "Subscriber list", source: "Mailchimp" },
    ],
    steps: [
      { n: 1, text: "Compile stories", owner: "Content lead" },
      { n: 2, text: "Draft newsletter", note: "If long-form > 600 words, split" },
      { n: 3, text: "Schedule send" },
    ],
    outputs: [
      { name: "Send report", source: "Mailchimp" },
      { name: "Engagement log", source: "Sheets" },
    ],
    tools: ["Mailchimp", "Notion", "Sheets"],
    automationScore: 88,
    automationRationale: "Recurring schedule, templated layout, and reporting are highly automatable.",
    x: 200,
    y: 700,
  },
  {
    id: "content",
    theme: "marketing",
    name: "Content publishing pipeline",
    trigger: { type: "event", description: "Draft moved to Ready-for-edit in Notion" },
    why: "Ship high-quality content without bottlenecks at review.",
    inputs: [
      { name: "Draft article", source: "Google Docs" },
      { name: "Style guide", source: "Notion" },
    ],
    steps: [
      { n: 1, text: "Editorial review", owner: "Editor" },
      { n: 2, text: "Run SEO check", note: "If score < 80, revise" },
      { n: 3, text: "Publish to CMS" },
    ],
    outputs: [
      { name: "Live article", source: "Webflow" },
      { name: "Social cards", source: "Buffer" },
    ],
    tools: ["Webflow", "Buffer", "Google Docs"],
    automationScore: 58,
    automationRationale: "Editorial judgement is human; SEO checks and publishing automate.",
    x: 1100,
    y: 800,
  },
  {
    id: "vendor",
    theme: "operations",
    name: "Vendor onboarding",
    trigger: { type: "event", description: "New vendor request added in procurement" },
    why: "Get vendors set up cleanly so payments and access don't stall.",
    inputs: [
      { name: "Vendor request", source: "Airtable" },
      { name: "Compliance checklist", source: "Notion" },
    ],
    steps: [
      { n: 1, text: "Verify documents", owner: "Ops manager" },
      { n: 2, text: "Set up payment", note: "If foreign vendor, add tax form" },
      { n: 3, text: "Provision access" },
    ],
    outputs: [
      { name: "Vendor record", source: "Airtable" },
      { name: "Payment profile", source: "Bill.com" },
    ],
    tools: ["Airtable", "Bill.com", "Notion"],
    automationScore: 36,
    automationRationale: "Document verification needs human review; only intake and provisioning automate.",
    x: 2000,
    y: 700,
  },
  {
    id: "invoice",
    theme: "finance",
    name: "Invoice approval",
    trigger: { type: "schedule", description: "Daily at 8am when invoices arrive in inbox" },
    why: "Pay vendors on time without rubber-stamping unauthorized spend.",
    inputs: [
      { name: "Invoice PDF", source: "Email" },
      { name: "Approval matrix", source: "Sheets" },
    ],
    steps: [
      { n: 1, text: "Parse invoice fields" },
      { n: 2, text: "Route for approval", note: "If > $5k, dual approval", owner: "Finance ops" },
      { n: 3, text: "Schedule payment" },
    ],
    outputs: [
      { name: "Approved invoice", source: "QuickBooks" },
      { name: "Payment scheduled", source: "Bill.com" },
    ],
    tools: ["QuickBooks", "Bill.com", "Sheets"],
    automationScore: 74,
    automationRationale: "Parsing, routing rules, and scheduling are all automatable; humans only approve.",
    x: 2900,
    y: 800,
  },
];

export const myBusinessCanvas: Canvas = {
  id: DEFAULT_CANVAS_ID,
  name: "My Business",
  workflowIds: [],
  connections: [],
  chainNames: {},
};

export const examplesCanvas: Canvas = {
  id: EXAMPLES_CANVAS_ID,
  name: "Examples",
  workflowIds: initialWorkflows.map((w) => w.id),
  connections: [
    { from: "qual", to: "discovery", label: "Qualified lead" },
    { from: "discovery", to: "proposal", label: "Discovery complete" },
    { from: "proposal", to: "close", label: "Proposal signed" },
  ],
  chainNames: {},
  readOnly: true,
};
