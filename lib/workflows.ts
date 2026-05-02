export type Theme = "sales" | "marketing" | "operations" | "finance";

export type IOItem = { name: string; source: string };

// Classification of a step's automation suitability. The user can override
// the model's pick; the overall workflow score is derived from these values.
export type StepClassification =
  | "automate"
  | "human_review"
  | "security_risk"
  | "needs_standardisation";

export type Step = {
  n: number;
  text: string;
  note?: string;
  owner?: string;
  // When the step came from a screen recording, this holds a data URL
  // captured from the recording at the timestamp the model identified.
  screenshot?: string;
  // The model classifies each step on first generation; the user can edit
  // the classification, which both updates the badge and recomputes the
  // workflow's overall automation score.
  classification?: StepClassification;
  classificationOverridden?: boolean;
};

const CLASSIFICATION_SCORES: Record<StepClassification, number> = {
  automate: 100,
  human_review: 50,
  security_risk: 25,
  needs_standardisation: 0,
};

// Compute the overall automation score from a workflow's classified steps.
// Unclassified steps are excluded — better to skip them than to bake an
// arbitrary default into the average.
export function calculateAutomationScore(steps: Step[]): number {
  const classified = steps.filter((s) => s.classification);
  if (classified.length === 0) return 0;
  const total = classified.reduce(
    (sum, s) => sum + CLASSIFICATION_SCORES[s.classification!],
    0
  );
  return Math.round(total / classified.length);
}

// UI metadata for each classification — colours used for tag pills, popover
// dots, and the legend. Kept here so it's the single source of truth.
export const CLASSIFICATION_META: Record<
  StepClassification,
  { label: string; description: string; bg: string; fg: string; dot: string }
> = {
  automate: {
    label: "Automate",
    description: "Rule-based, safe for an agent to handle",
    bg: "#EBF4DD",
    fg: "#547863",
    dot: "#547863",
  },
  human_review: {
    label: "Human review",
    description: "Judgment required — agent should pause",
    bg: "#FEF3E2",
    fg: "#C99461",
    dot: "#C99461",
  },
  security_risk: {
    // Distinct red palette so this doesn't blend with human_review's amber.
    // Reuses the same red we use for inline error banners elsewhere.
    label: "Security risk",
    description: "Sensitive data or consequential action",
    bg: "#FDECEC",
    fg: "#8B2A2A",
    dot: "#C0392B",
  },
  needs_standardisation: {
    label: "Needs standardisation",
    description: "Too variable to automate reliably",
    bg: "#F1EFE8",
    fg: "#888780",
    dot: "#888780",
  },
};

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
      { n: 1, text: "Receive inbound lead", classification: "automate" },
      { n: 2, text: "Score against ICP", note: "If score > 7, proceed", owner: "Rev Ops", classification: "automate" },
      { n: 3, text: "Send personalised outreach", owner: "Sales lead", classification: "human_review" },
      { n: 4, text: "Log to CRM", classification: "automate" },
    ],
    outputs: [
      { name: "Qualified lead record", source: "HubSpot" },
      { name: "Follow-up sent", source: "Gmail" },
    ],
    tools: ["HubSpot", "Gmail", "Notion"],
    automationScore: 0,
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
      { n: 1, text: "Schedule call", classification: "automate" },
      { n: 2, text: "Run discovery", note: "If budget confirmed, advance", owner: "AE", classification: "human_review" },
      { n: 3, text: "Capture pain points", classification: "human_review" },
      { n: 4, text: "Update opportunity", classification: "automate" },
    ],
    outputs: [
      { name: "Discovery notes", source: "HubSpot" },
      { name: "Call recording", source: "Gong" },
    ],
    tools: ["HubSpot", "Calendly", "Gong"],
    automationScore: 0,
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
      { n: 1, text: "Draft proposal", classification: "automate" },
      { n: 2, text: "Internal review", note: "If discount > 15%, escalate", owner: "Solutions", classification: "human_review" },
      { n: 3, text: "Send to prospect", classification: "automate" },
      { n: 4, text: "Track open + reply", classification: "automate" },
    ],
    outputs: [
      { name: "Signed proposal link", source: "DocuSign" },
      { name: "Quote record", source: "HubSpot" },
    ],
    tools: ["DocuSign", "HubSpot", "Sheets"],
    automationScore: 0,
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
      { n: 1, text: "Mark deal closed-won", classification: "automate" },
      { n: 2, text: "Trigger invoice", note: "If annual, send PO request", classification: "automate" },
      { n: 3, text: "Kick off onboarding", owner: "CSM", classification: "human_review" },
      { n: 4, text: "Schedule QBR", classification: "automate" },
    ],
    outputs: [
      { name: "Customer record", source: "HubSpot" },
      { name: "Onboarding plan", source: "Notion" },
    ],
    tools: ["HubSpot", "Stripe", "Notion"],
    automationScore: 0,
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
      { n: 1, text: "Compile stories", owner: "Content lead", classification: "human_review" },
      { n: 2, text: "Draft newsletter", note: "If long-form > 600 words, split", classification: "automate" },
      { n: 3, text: "Schedule send", classification: "automate" },
    ],
    outputs: [
      { name: "Send report", source: "Mailchimp" },
      { name: "Engagement log", source: "Sheets" },
    ],
    tools: ["Mailchimp", "Notion", "Sheets"],
    automationScore: 0,
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
      { n: 1, text: "Editorial review", owner: "Editor", classification: "human_review" },
      { n: 2, text: "Run SEO check", note: "If score < 80, revise", classification: "automate" },
      { n: 3, text: "Publish to CMS", classification: "automate" },
    ],
    outputs: [
      { name: "Live article", source: "Webflow" },
      { name: "Social cards", source: "Buffer" },
    ],
    tools: ["Webflow", "Buffer", "Google Docs"],
    automationScore: 0,
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
      { n: 1, text: "Verify documents", owner: "Ops manager", classification: "human_review" },
      { n: 2, text: "Set up payment", note: "If foreign vendor, add tax form", classification: "security_risk" },
      { n: 3, text: "Provision access", classification: "security_risk" },
    ],
    outputs: [
      { name: "Vendor record", source: "Airtable" },
      { name: "Payment profile", source: "Bill.com" },
    ],
    tools: ["Airtable", "Bill.com", "Notion"],
    automationScore: 0,
    automationRationale: "Document verification needs human review; payment + access provisioning are sensitive actions.",
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
      { n: 1, text: "Parse invoice fields", classification: "automate" },
      { n: 2, text: "Route for approval", note: "If > $5k, dual approval", owner: "Finance ops", classification: "human_review" },
      { n: 3, text: "Schedule payment", classification: "security_risk" },
    ],
    outputs: [
      { name: "Approved invoice", source: "QuickBooks" },
      { name: "Payment scheduled", source: "Bill.com" },
    ],
    tools: ["QuickBooks", "Bill.com", "Sheets"],
    automationScore: 0,
    automationRationale: "Parsing automates cleanly; approval needs judgement; scheduling payments is consequential.",
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
