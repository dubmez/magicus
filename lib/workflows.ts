export type Theme = "sales" | "marketing" | "operations" | "finance";

export type IOItem = { name: string; source: string };

// How automatable a single step is, on its own merits.
//   high   — rule-based, deterministic, no judgment needed
//   medium — automatable but benefits from human oversight
//   low    — requires human judgment, creativity, or relationship context
// `isSensitive` is orthogonal: a step can be high-potential AND sensitive
// (e.g. processing a templated payment is rule-based but moves money).
export type AutomationPotential = "high" | "medium" | "low";

export type Step = {
  n: number;
  text: string;
  note?: string;
  owner?: string;
  // Data URL captured from a screen recording at the model's chosen timestamp.
  screenshot?: string;
  // Model classifies on generation; user can edit which marks the override
  // flag so the UI shows a dashed border + pencil affordance.
  automationPotential?: AutomationPotential;
  automationPotentialOverridden?: boolean;
  // Independent flag — payment data, personal data, legal decisions,
  // consequential irreversible actions. The lock icon in the UI is driven
  // entirely by this.
  isSensitive?: boolean;
};

const POTENTIAL_SCORES: Record<AutomationPotential, number> = {
  high: 100,
  medium: 50,
  low: 0,
};

// Average across steps that have a potential set. Unclassified steps are
// excluded so the score stays meaningful while a workflow is being built.
export function calculateAutomationScore(steps: Step[]): number {
  const scored = steps.filter((s) => s.automationPotential);
  if (scored.length === 0) return 0;
  const total = scored.reduce(
    (sum, s) => sum + POTENTIAL_SCORES[s.automationPotential!],
    0
  );
  return Math.round(total / scored.length);
}

// UI metadata for each automation-potential tier — pill colours, popover
// dots, legend swatches. Single source of truth.
export const POTENTIAL_META: Record<
  AutomationPotential,
  { label: string; description: string; bg: string; fg: string; dot: string }
> = {
  high: {
    label: "High potential",
    description: "Rule-based and safe to fully automate",
    bg: "#EBF4DD",
    fg: "#547863",
    dot: "#547863",
  },
  medium: {
    label: "Medium potential",
    description: "Automatable but benefits from human oversight",
    bg: "#FEF3E2",
    fg: "#C99461",
    dot: "#C99461",
  },
  low: {
    label: "Low potential",
    description: "Requires human judgment or relationship context",
    bg: "#F1EFE8",
    fg: "#888780",
    dot: "#888780",
  },
};

// Sensitive flag UI metadata — used by the lock icon and legend item. Kept
// here alongside POTENTIAL_META so the shared view, detail panel, and
// butterfly card all read from one definition.
export const SENSITIVE_META = {
  label: "Sensitive",
  description: "Contains payment data, personal data, or consequential actions",
  // Muted red — same palette as inline error banners.
  fg: "#8B2A2A",
  dot: "#C0392B",
};

export type Trigger = {
  type: "schedule" | "event" | "manual" | "chained";
  description?: string;
};

// Set when the workflow was cloned from a public share. Renders subtly in
// the detail panel as 'Remixed from {sharedBy}'s {workflowName}'.
export type RemixedFrom = {
  workflowName: string;
  sharedBy: string;
  // The original share token, so we can hop back to the source view if
  // it's still discoverable on this device (best effort — localStorage only).
  shareToken?: string;
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
  remixedFrom?: RemixedFrom;
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
// Automation potentials are seeded as if LLM-generated (override flag left
// undefined so the UI treats them as not user-edited).
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
      { n: 1, text: "Check submission in Gmail", automationPotential: "high" },
      { n: 2, text: "Score lead against ICP in Notion doc", note: "Judgment call on fit", automationPotential: "low" },
      { n: 3, text: "If qualified, add to HubSpot CRM with tags", automationPotential: "high" },
      { n: 4, text: "Send personalised intro email from Gmail template", automationPotential: "medium" },
      { n: 5, text: "Set follow-up reminder in HubSpot", automationPotential: "high" },
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
      { n: 1, text: "Export published article from Ghost", automationPotential: "high" },
      { n: 2, text: "Paste into Claude and generate 5 tweet variants", automationPotential: "high" },
      { n: 3, text: "Review and select best tweet", note: "Tone and relevance check", automationPotential: "low" },
      { n: 4, text: "Schedule selected tweet in Buffer", automationPotential: "high" },
      { n: 5, text: "Generate LinkedIn post variant and save as draft", automationPotential: "high" },
      { n: 6, text: "Add article to Notion content archive", automationPotential: "high" },
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
      { n: 1, text: "Pull completed projects from Notion tracker", automationPotential: "high" },
      { n: 2, text: "Generate invoice in Stripe for each project", automationPotential: "high", isSensitive: true },
      { n: 3, text: "Send invoice email with personalised note", note: "Check amounts and add personal note", automationPotential: "medium", isSensitive: true },
      { n: 4, text: "Log invoice in Airtable revenue tracker", automationPotential: "high" },
      { n: 5, text: "Set payment follow-up reminder if unpaid after 7 days", automationPotential: "high" },
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
      { n: 1, text: "Pull account firmographics from Apollo", automationPotential: "high" },
      { n: 2, text: "Research recent company news via Perplexity", automationPotential: "high" },
      { n: 3, text: "Score account against ICP rubric", automationPotential: "medium" },
      { n: 4, text: "Write personalised first-touch email using research", note: "Approve before sending", automationPotential: "low" },
      { n: 5, text: "Enrol in HubSpot sequence", automationPotential: "high" },
      { n: 6, text: "Assign to SDR and log in Slack channel", automationPotential: "high" },
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
      { n: 1, text: "Pull call notes from Fireflies transcript", automationPotential: "high" },
      { n: 2, text: "Extract key pain points and requirements", automationPotential: "medium" },
      { n: 3, text: "Generate first draft proposal in Google Docs using template", automationPotential: "medium" },
      { n: 4, text: "AE reviews and edits proposal", note: "Customise pricing and scope", automationPotential: "low" },
      { n: 5, text: "Send proposal via DocuSign", automationPotential: "high", isSensitive: true },
      { n: 6, text: "Update HubSpot deal with proposal link and expected close date", automationPotential: "high" },
      { n: 7, text: "Notify sales manager in Slack", automationPotential: "high" },
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
      { n: 1, text: "Pull all open deals from HubSpot", automationPotential: "high" },
      { n: 2, text: "Flag deals with no activity in 7+ days", automationPotential: "high" },
      { n: 3, text: "Generate pipeline summary doc in Notion", automationPotential: "high" },
      { n: 4, text: "Add manager commentary on flagged deals", note: "Add context and next actions", automationPotential: "low" },
      { n: 5, text: "Post summary to #revenue Slack channel", automationPotential: "high" },
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
      { n: 1, text: "Create client workspace in Notion from template", automationPotential: "high" },
      { n: 2, text: "Set up client Slack channel and invite team", automationPotential: "high" },
      { n: 3, text: "Send welcome email with onboarding doc link", automationPotential: "high" },
      { n: 4, text: "Schedule kickoff call in Calendly", automationPotential: "high" },
      { n: 5, text: "Create onboarding project in Asana with default tasks", automationPotential: "high" },
      { n: 6, text: "Brief internal team in Slack with client context", note: "Add strategic context before sending", automationPotential: "medium" },
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
      { n: 1, text: "Pull product usage data from Mixpanel for all active accounts", automationPotential: "high" },
      { n: 2, text: "Flag accounts below engagement threshold", automationPotential: "high" },
      { n: 3, text: "Check NPS scores submitted in last 30 days", automationPotential: "high" },
      { n: 4, text: "Cross-reference with open support tickets in Intercom", automationPotential: "high" },
      { n: 5, text: "CSM reviews flagged accounts and decides action", note: "Prioritise and assign interventions", automationPotential: "low" },
      { n: 6, text: "Log health scores and actions in HubSpot", automationPotential: "high" },
      { n: 7, text: "Send at-risk account alerts to CSM Slack channel", automationPotential: "high" },
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
      { n: 1, text: "Pull account usage summary from Mixpanel", automationPotential: "high" },
      { n: 2, text: "Identify expansion signals — seats, feature adoption, NPS", automationPotential: "medium" },
      { n: 3, text: "Generate renewal talking points doc in Notion", automationPotential: "medium" },
      { n: 4, text: "CSM reviews and adds relationship context", note: "Personalise based on relationship history", automationPotential: "low" },
      { n: 5, text: "Send renewal outreach email from HubSpot template", automationPotential: "medium" },
      { n: 6, text: "Schedule renewal call via Calendly", automationPotential: "high" },
      { n: 7, text: "Log renewal status and next steps in HubSpot", automationPotential: "high" },
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
