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

// Examples shipped on the read-only Examples canvas. Three archetype playbooks
// of three workflows each, laid out as horizontal chains stacked vertically.
// Classifications are LLM-generated (classificationOverridden is left
// undefined which the UI treats as not overridden).
//
// Layout: each chain is a row at y = 0 / 700 / 1400, columns at x = 0 / 800 / 1600.
export const initialWorkflows: Workflow[] = [
  // ─── Solo Founder Playbook ─────────────────────────────────────────────
  {
    id: "founder-triage",
    theme: "sales",
    name: "Inbound lead triage",
    trigger: { type: "event", description: "New contact form submission received" },
    why: "Stop leaking high-fit leads while you're heads-down on the product.",
    inputs: [
      { name: "Contact form data", source: "Typeform" },
      { name: "ICP criteria", source: "Notion" },
    ],
    steps: [
      { n: 1, text: "Check submission in Gmail", classification: "automate" },
      { n: 2, text: "Score lead against ICP in Notion doc", note: "Judgment call on fit", classification: "human_review" },
      { n: 3, text: "If qualified, add to HubSpot CRM with tags", classification: "automate" },
      { n: 4, text: "Send personalised intro email from Gmail template", classification: "automate" },
      { n: 5, text: "Set follow-up reminder in HubSpot", classification: "automate" },
    ],
    outputs: [
      { name: "New contact in HubSpot", source: "HubSpot" },
      { name: "Intro email sent", source: "Gmail" },
      { name: "Follow-up scheduled", source: "HubSpot" },
    ],
    tools: ["Gmail", "Typeform", "HubSpot", "Notion"],
    automationScore: 0,
    automationRationale: "Most steps are rule-based — only the ICP scoring judgment needs a human.",
    x: 0,
    y: 0,
  },
  {
    id: "founder-content",
    theme: "marketing",
    name: "Weekly content repurposing",
    trigger: { type: "schedule", description: "Every Tuesday after publishing" },
    why: "Get more reach from each long-form piece without spending hours on social.",
    inputs: [
      { name: "Published article", source: "Ghost" },
      { name: "Brand voice doc", source: "Notion" },
    ],
    steps: [
      { n: 1, text: "Export published article from Ghost", classification: "automate" },
      { n: 2, text: "Paste into Claude and generate 5 tweet variants", classification: "automate" },
      { n: 3, text: "Review and select best tweet", note: "Tone and relevance check", classification: "human_review" },
      { n: 4, text: "Schedule selected tweet in Buffer", classification: "automate" },
      { n: 5, text: "Generate LinkedIn post variant and save as draft", classification: "automate" },
      { n: 6, text: "Add article to Notion content archive", classification: "automate" },
    ],
    outputs: [
      { name: "Scheduled tweet", source: "Buffer" },
      { name: "LinkedIn draft", source: "LinkedIn" },
      { name: "Updated content archive", source: "Notion" },
    ],
    tools: ["Ghost", "Claude", "Buffer", "Notion", "LinkedIn"],
    automationScore: 0,
    automationRationale: "Generation and scheduling are templated — only the tweet selection needs taste.",
    x: 800,
    y: 0,
  },
  {
    id: "founder-invoicing",
    theme: "finance",
    name: "Monthly invoicing",
    trigger: { type: "schedule", description: "1st of every month" },
    why: "Bill on time without spending half a day each month chasing details.",
    inputs: [
      { name: "Project tracker", source: "Notion" },
      { name: "Client billing details", source: "Stripe" },
    ],
    steps: [
      { n: 1, text: "Pull completed projects from Notion tracker", classification: "automate" },
      { n: 2, text: "Generate invoice in Stripe for each project", classification: "automate" },
      { n: 3, text: "Send invoice email with personalised note", note: "Check amounts and add personal note", classification: "human_review" },
      { n: 4, text: "Log invoice in Airtable revenue tracker", classification: "automate" },
      { n: 5, text: "Set payment follow-up reminder if unpaid after 7 days", classification: "automate" },
    ],
    outputs: [
      { name: "Invoice sent", source: "Stripe" },
      { name: "Revenue log updated", source: "Airtable" },
      { name: "Follow-up scheduled", source: "Stripe" },
    ],
    tools: ["Notion", "Stripe", "Gmail", "Airtable"],
    automationScore: 0,
    automationRationale: "Pulling, generating, and logging automate cleanly — only the personal note needs you.",
    x: 1600,
    y: 0,
  },

  // ─── GTM Engine ────────────────────────────────────────────────────────
  {
    id: "gtm-outbound",
    theme: "sales",
    name: "Outbound sequence enrolment",
    trigger: { type: "event", description: "New account added to target list in HubSpot" },
    why: "Hit speed-to-first-touch without sacrificing personalisation.",
    inputs: [
      { name: "Target account list", source: "HubSpot" },
      { name: "ICP rubric", source: "Notion" },
      { name: "Company research", source: "Perplexity" },
    ],
    steps: [
      { n: 1, text: "Pull account firmographics from Apollo", classification: "automate" },
      { n: 2, text: "Research recent company news via Perplexity", classification: "automate" },
      { n: 3, text: "Score account against ICP rubric", classification: "automate" },
      { n: 4, text: "Write personalised first-touch email using research", note: "Approve before sending", classification: "human_review" },
      { n: 5, text: "Enrol in HubSpot sequence", classification: "automate" },
      { n: 6, text: "Assign to SDR and log in Slack channel", classification: "automate" },
    ],
    outputs: [
      { name: "Personalised email sent", source: "Gmail" },
      { name: "Account in sequence", source: "HubSpot" },
      { name: "SDR notified", source: "Slack" },
    ],
    tools: ["HubSpot", "Apollo", "Perplexity", "Slack", "Gmail"],
    automationScore: 0,
    automationRationale: "Research and routing run unattended — only the personalised first-touch needs human review.",
    x: 0,
    y: 700,
  },
  {
    id: "gtm-proposal",
    theme: "sales",
    name: "Demo-to-proposal handoff",
    trigger: { type: "event", description: "Deal stage moved to 'Proposal' in HubSpot" },
    why: "Turn the discovery call into a proposal in hours, not days.",
    inputs: [
      { name: "Call transcript", source: "Fireflies" },
      { name: "Proposal template", source: "Google Docs" },
      { name: "Deal data", source: "HubSpot" },
    ],
    steps: [
      { n: 1, text: "Pull call notes from Fireflies transcript", classification: "automate" },
      { n: 2, text: "Extract key pain points and requirements", classification: "automate" },
      { n: 3, text: "Generate first draft proposal in Google Docs using template", classification: "automate" },
      { n: 4, text: "AE reviews and edits proposal", note: "Customise pricing and scope", classification: "human_review" },
      { n: 5, text: "Send proposal via DocuSign", classification: "automate" },
      { n: 6, text: "Update HubSpot deal with proposal link and expected close date", classification: "automate" },
      { n: 7, text: "Notify sales manager in Slack", classification: "automate" },
    ],
    outputs: [
      { name: "Proposal sent", source: "DocuSign" },
      { name: "HubSpot updated", source: "HubSpot" },
      { name: "Manager notified", source: "Slack" },
    ],
    tools: ["Fireflies", "Google Docs", "HubSpot", "DocuSign", "Slack"],
    automationScore: 0,
    automationRationale: "Drafting and routing automate — pricing and scope decisions need the AE's judgment.",
    x: 800,
    y: 700,
  },
  {
    id: "gtm-pipeline",
    theme: "operations",
    name: "Pipeline review prep",
    trigger: { type: "schedule", description: "Every Friday at 4pm" },
    why: "Keep the manager's pipeline review focused on decisions, not data gathering.",
    inputs: [
      { name: "HubSpot pipeline data", source: "HubSpot" },
      { name: "Last week's review doc", source: "Notion" },
    ],
    steps: [
      { n: 1, text: "Pull all open deals from HubSpot", classification: "automate" },
      { n: 2, text: "Flag deals with no activity in 7+ days", classification: "automate" },
      { n: 3, text: "Generate pipeline summary doc in Notion", classification: "automate" },
      { n: 4, text: "Add manager commentary on flagged deals", note: "Add context and next actions", classification: "human_review" },
      { n: 5, text: "Post summary to #revenue Slack channel", classification: "automate" },
    ],
    outputs: [
      { name: "Pipeline summary", source: "Notion" },
      { name: "Slack post", source: "Slack" },
      { name: "Flagged deals list", source: "Notion" },
    ],
    tools: ["HubSpot", "Notion", "Slack"],
    automationScore: 0,
    automationRationale: "Data pull and posting are mechanical — only the commentary on flagged deals needs the manager.",
    x: 1600,
    y: 700,
  },

  // ─── Client Ops Playbook ───────────────────────────────────────────────
  {
    id: "ops-onboarding",
    theme: "operations",
    name: "New client onboarding",
    trigger: { type: "event", description: "Contract signed in DocuSign" },
    why: "Move from 'signed' to 'value delivered' without dropping context between teams.",
    inputs: [
      { name: "Signed contract", source: "DocuSign" },
      { name: "Client details", source: "HubSpot" },
      { name: "Onboarding template", source: "Notion" },
    ],
    steps: [
      { n: 1, text: "Create client workspace in Notion from template", classification: "automate" },
      { n: 2, text: "Set up client Slack channel and invite team", classification: "automate" },
      { n: 3, text: "Send welcome email with onboarding doc link", classification: "automate" },
      { n: 4, text: "Schedule kickoff call in Calendly", classification: "automate" },
      { n: 5, text: "Create onboarding project in Asana with default tasks", classification: "automate" },
      { n: 6, text: "Brief internal team in Slack with client context", note: "Add strategic context before sending", classification: "human_review" },
    ],
    outputs: [
      { name: "Client workspace", source: "Notion" },
      { name: "Client Slack channel", source: "Slack" },
      { name: "Welcome email sent", source: "Gmail" },
      { name: "Kickoff scheduled", source: "Calendly" },
      { name: "Onboarding project", source: "Asana" },
    ],
    tools: ["DocuSign", "Notion", "Slack", "Calendly", "Asana", "HubSpot"],
    automationScore: 0,
    automationRationale: "Fully automatable except for the strategic context brief before client comms.",
    x: 0,
    y: 1400,
  },
  {
    id: "ops-health",
    theme: "operations",
    name: "Customer health check",
    trigger: { type: "schedule", description: "Every Monday morning" },
    why: "Spot churn signals before they become churn — and route attention where it's needed.",
    inputs: [
      { name: "Usage data", source: "Mixpanel" },
      { name: "NPS responses", source: "HubSpot" },
      { name: "Support tickets", source: "Intercom" },
    ],
    steps: [
      { n: 1, text: "Pull product usage data from Mixpanel for all active accounts", classification: "automate" },
      { n: 2, text: "Flag accounts below engagement threshold", classification: "automate" },
      { n: 3, text: "Check NPS scores submitted in last 30 days", classification: "automate" },
      { n: 4, text: "Cross-reference with open support tickets in Intercom", classification: "automate" },
      { n: 5, text: "CSM reviews flagged accounts and decides action", note: "Prioritise and assign interventions", classification: "human_review" },
      { n: 6, text: "Log health scores and actions in HubSpot", classification: "automate" },
      { n: 7, text: "Send at-risk account alerts to CSM Slack channel", classification: "automate" },
    ],
    outputs: [
      { name: "Health score log", source: "HubSpot" },
      { name: "At-risk alerts", source: "Slack" },
      { name: "CSM action list", source: "HubSpot" },
    ],
    tools: ["Mixpanel", "Intercom", "HubSpot", "Slack"],
    automationScore: 0,
    automationRationale: "Data assembly and alerting run unattended — only the prioritisation call needs the CSM.",
    x: 800,
    y: 1400,
  },
  {
    id: "ops-renewal",
    theme: "operations",
    name: "Renewal and expansion outreach",
    trigger: { type: "event", description: "Contract renewal date within 60 days in HubSpot" },
    why: "Walk into every renewal call with the data prepped and the relationship context warm.",
    inputs: [
      { name: "Contract data", source: "HubSpot" },
      { name: "Usage data", source: "Mixpanel" },
      { name: "NPS history", source: "HubSpot" },
    ],
    steps: [
      { n: 1, text: "Pull account usage summary from Mixpanel", classification: "automate" },
      { n: 2, text: "Identify expansion signals — seats, feature adoption, NPS", classification: "automate" },
      { n: 3, text: "Generate renewal talking points doc in Notion", classification: "automate" },
      { n: 4, text: "CSM reviews and adds relationship context", note: "Personalise based on relationship history", classification: "human_review" },
      { n: 5, text: "Send renewal outreach email from HubSpot template", classification: "automate" },
      { n: 6, text: "Schedule renewal call via Calendly", classification: "automate" },
      { n: 7, text: "Log renewal status and next steps in HubSpot", classification: "automate" },
    ],
    outputs: [
      { name: "Talking points doc", source: "Notion" },
      { name: "Outreach email sent", source: "Gmail" },
      { name: "Renewal call scheduled", source: "Calendly" },
    ],
    tools: ["HubSpot", "Mixpanel", "Notion", "Calendly", "Gmail"],
    automationScore: 0,
    automationRationale: "Talking points and outreach automate cleanly — only the relationship personalisation needs the CSM.",
    x: 1600,
    y: 1400,
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
  // Connections define each archetype as one chain (computeChains groups them
  // by connected component). Labels carry meaning where one workflow leads
  // logically to the next; founder-archetype activities are independent
  // playbook entries so they stay unlabelled.
  connections: [
    { from: "founder-triage", to: "founder-content" },
    { from: "founder-content", to: "founder-invoicing" },
    { from: "gtm-outbound", to: "gtm-proposal" },
    { from: "gtm-proposal", to: "gtm-pipeline" },
    { from: "ops-onboarding", to: "ops-health", label: "Once onboarded" },
    { from: "ops-health", to: "ops-renewal", label: "If healthy" },
  ],
  // chainNames key = chainKey(ids) = sorted ids joined with '|'.
  chainNames: {
    "founder-content|founder-invoicing|founder-triage": "Solo Founder Playbook",
    "gtm-outbound|gtm-pipeline|gtm-proposal": "GTM Engine",
    "ops-health|ops-onboarding|ops-renewal": "Client Ops Playbook",
  },
  readOnly: true,
};
