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

// Set on a workflow that was cloned from the Library via "Adapt this".
// Renders in the detail panel as "Adapted from {Name} · Library".
export type AdaptedFrom = {
  libraryId: string;
  name: string;
  contributedBy?: { name: string; avatarUrl?: string };
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
  adaptedFrom?: AdaptedFrom;

  // ── Library-specific (optional) ─────────────────────────────────────────
  // When these are set, the workflow is part of the public Library and
  // renders read-only. User workflows leave them undefined. Adapting a
  // library workflow strips these and writes `adaptedFrom` instead.
  libraryId?: string;
  category?: LibraryCategory;
  contributedBy?: { name: string; avatarUrl?: string };
  adaptCount?: number;
  isSeeded?: boolean;
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

// Library is the read-only collection users browse and adapt from.
// Canvas id stays as the legacy "canvas-examples" string so existing
// stored records keep matching after the rename. The constant name and
// every user-facing label updates to "Library".
export const LIBRARY_CANVAS_ID = "canvas-examples";
export const DEFAULT_CANVAS_ID = "canvas-default";

// Workflow category for the Library. Each seeded library workflow
// belongs to exactly one category; community contributions later
// inherit the same set.
export type LibraryCategory =
  | "solo_founder"
  | "gtm_operator"
  | "ops_manager"
  | "ecommerce_ops";

export const LIBRARY_CATEGORY_META: Record<
  LibraryCategory,
  { label: string }
> = {
  solo_founder: { label: "Solo Founder" },
  gtm_operator: { label: "GTM Operator" },
  ops_manager: { label: "Ops Manager" },
  ecommerce_ops: { label: "E-commerce Ops" },
};

// Order categories appear in the sidebar.
export const LIBRARY_CATEGORY_ORDER: LibraryCategory[] = [
  "solo_founder",
  "gtm_operator",
  "ops_manager",
  "ecommerce_ops",
];

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

// Library — sixteen seeded templates across four categories. Each
// category gets one chain (3 workflows for Solo Founder / GTM / Ops, 2
// for E-commerce Ops) plus standalone workflows. Layout: rows by
// category at y = 0 / 700 / 1400 / 2100; columns at x = 0 / 800 / 1600
// for chained workflows, then 2400 / 3200 for standalone workflows in
// the same row.
//
// Workflow IDs are prefixed `lib-` so they never collide with a user
// workflow. `isSeeded: true` + `contributedBy: { name: "Magicus Team" }`
// + `category` + `libraryId` mark them as Library content for the
// sidebar grouping and the "Adapt this" CTA in the detail panel.
//
// `contributedBy` shows the human-friendly attribution shown in the
// detail panel. `adaptCount` increments locally each time a user
// adapts; persistence comes later when community contributions land.

// Shared library metadata that every seeded workflow carries — keeps
// the per-workflow blocks below readable and ensures any future tweak
// to defaults flows through.
const SEED_DEFAULTS = {
  contributedBy: { name: "Magicus Team" },
  adaptCount: 0,
  isSeeded: true as const,
};
export const initialWorkflows: Workflow[] = [
  // ─── Category 1: Solo Founder ──────────────────────────────────────────
  // Chain "Solo Founder Playbook" — 1, 2, 3 connected in sequence.
  {
    ...SEED_DEFAULTS,
    libraryId: "lib-founder-triage",
    id: "lib-founder-triage",
    category: "solo_founder",
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
      { n: 2, text: "Score lead against ICP criteria in Notion", note: "Judgment call on fit", automationPotential: "medium" },
      { n: 3, text: "If qualified, add to HubSpot with tags", automationPotential: "high" },
      { n: 4, text: "Send personalised intro email from Gmail template", automationPotential: "high" },
      { n: 5, text: "Set follow-up reminder in HubSpot", automationPotential: "high" },
    ],
    outputs: [
      { name: "New contact in HubSpot", source: "HubSpot" },
      { name: "Intro email sent", source: "Gmail" },
      { name: "Follow-up scheduled", source: "HubSpot" },
    ],
    tools: ["Gmail", "Typeform", "HubSpot", "Notion"],
    automationScore: 0,
    automationRationale: "Routing and logging are fully automatable — only the ICP scoring judgment needs a human.",
    x: 0, y: 0,
  },
  {
    ...SEED_DEFAULTS,
    libraryId: "lib-founder-content",
    id: "lib-founder-content",
    category: "solo_founder",
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
      { n: 2, text: "Generate 5 tweet variants in Claude", automationPotential: "high" },
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
    automationRationale: "Generation and scheduling are fully automatable — editorial judgment on which tweet to use stays human.",
    x: 800, y: 0,
  },
  {
    ...SEED_DEFAULTS,
    libraryId: "lib-founder-invoicing",
    id: "lib-founder-invoicing",
    category: "solo_founder",
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
      { n: 2, text: "Generate invoice in Stripe for each project", automationPotential: "high" },
      { n: 3, text: "Send invoice with personalised note", note: "Check amounts and add personal touch", automationPotential: "medium", isSensitive: true },
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
    automationRationale: "Generation and logging are automatable — sending money requests benefits from a human check first.",
    x: 1600, y: 0,
  },
  // Standalone Solo Founder workflows.
  {
    ...SEED_DEFAULTS,
    libraryId: "lib-founder-subscriber-onboarding",
    id: "lib-founder-subscriber-onboarding",
    category: "solo_founder",
    theme: "marketing",
    name: "New subscriber onboarding",
    trigger: { type: "event", description: "New subscriber joins email list" },
    why: "Welcome new subscribers cleanly and surface high-value sign-ups in real time.",
    inputs: [
      { name: "Subscriber data", source: "Typeform" },
      { name: "Source tag", source: "Website" },
    ],
    steps: [
      { n: 1, text: "Tag subscriber by source in ConvertKit", automationPotential: "high" },
      { n: 2, text: "Enrol in 3-email welcome sequence", automationPotential: "high" },
      { n: 3, text: "Add to appropriate nurture track based on tag", automationPotential: "high" },
      { n: 4, text: "Notify founder in Slack if subscriber came from a high-value source", automationPotential: "high" },
    ],
    outputs: [
      { name: "Subscriber in nurture track", source: "ConvertKit" },
      { name: "Founder notified", source: "Slack" },
    ],
    tools: ["ConvertKit", "Typeform", "Slack"],
    automationScore: 0,
    automationRationale: "Fully automatable — tagging, sequencing and routing are all rule-based.",
    x: 2400, y: 0,
  },
  {
    ...SEED_DEFAULTS,
    libraryId: "lib-founder-weekly-review",
    id: "lib-founder-weekly-review",
    category: "solo_founder",
    theme: "operations",
    name: "End-of-week personal review",
    trigger: { type: "schedule", description: "Every Friday at 5pm" },
    why: "Close the week with a clear-eyed read on what shipped, what earned, and what's next.",
    inputs: [
      { name: "Task data", source: "Todoist" },
      { name: "Time data", source: "Toggl" },
      { name: "Revenue data", source: "Stripe" },
    ],
    steps: [
      { n: 1, text: "Pull completed tasks from Todoist", automationPotential: "high" },
      { n: 2, text: "Pull time logged from Toggl", automationPotential: "high" },
      { n: 3, text: "Pull revenue events from Stripe", automationPotential: "high" },
      { n: 4, text: "Generate personal weekly summary in Notion", automationPotential: "high" },
      { n: 5, text: "Review and add reflections", note: "Personal sense-check and next week intentions", automationPotential: "low" },
    ],
    outputs: [
      { name: "Weekly review doc", source: "Notion" },
    ],
    tools: ["Todoist", "Toggl", "Stripe", "Claude", "Notion"],
    automationScore: 0,
    automationRationale: "Data aggregation and summary generation are fully automatable — personal reflection stays human.",
    x: 3200, y: 0,
  },

  // ─── Category 2: GTM Operator ──────────────────────────────────────────
  // Chain "GTM Engine" — 4, 5, 6 connected in sequence.
  {
    ...SEED_DEFAULTS,
    libraryId: "lib-gtm-lead-to-call",
    id: "lib-gtm-lead-to-call",
    category: "gtm_operator",
    theme: "sales",
    name: "Inbound lead to first call",
    trigger: { type: "event", description: "New lead form submitted" },
    why: "Beat the speed-to-lead game without sacrificing personalisation or rep context.",
    inputs: [
      { name: "Lead form data", source: "Typeform" },
      { name: "ICP rubric", source: "Notion" },
    ],
    steps: [
      { n: 1, text: "Score lead against ICP rubric", automationPotential: "high" },
      { n: 2, text: "Send personalised email within 5 minutes", automationPotential: "high" },
      { n: 3, text: "Book meeting via Calendly", automationPotential: "high" },
      { n: 4, text: "Brief rep in Slack with lead context", automationPotential: "high" },
      { n: 5, text: "Log in HubSpot with tags and next action", automationPotential: "high" },
    ],
    outputs: [
      { name: "Email sent", source: "Gmail" },
      { name: "Meeting booked", source: "Calendly" },
      { name: "Rep briefed", source: "Slack" },
      { name: "HubSpot updated", source: "HubSpot" },
    ],
    tools: ["HubSpot", "Typeform", "Calendly", "Slack", "Gmail"],
    automationScore: 0,
    automationRationale: "Fully automatable — scoring, routing and logging are all rule-based.",
    x: 0, y: 700,
  },
  {
    ...SEED_DEFAULTS,
    libraryId: "lib-gtm-post-demo",
    id: "lib-gtm-post-demo",
    category: "gtm_operator",
    theme: "sales",
    name: "Post-demo follow-up",
    trigger: { type: "event", description: "Demo marked complete in HubSpot" },
    why: "Turn a finished demo into a next-step email before the prospect cools off.",
    inputs: [
      { name: "Call transcript", source: "Fireflies" },
      { name: "Email template", source: "Notion" },
      { name: "Deal data", source: "HubSpot" },
    ],
    steps: [
      { n: 1, text: "Pull Fireflies call transcript", automationPotential: "high" },
      { n: 2, text: "Extract key pain points and requirements", automationPotential: "high" },
      { n: 3, text: "Generate first draft follow-up email", automationPotential: "medium" },
      { n: 4, text: "AE reviews and sends", note: "Personalise tone and check accuracy", automationPotential: "low" },
      { n: 5, text: "Update HubSpot deal stage and next steps", automationPotential: "high" },
    ],
    outputs: [
      { name: "Follow-up email sent", source: "Gmail" },
      { name: "HubSpot updated", source: "HubSpot" },
    ],
    tools: ["Fireflies", "HubSpot", "Claude", "Gmail"],
    automationScore: 0,
    automationRationale: "Transcript extraction and draft generation are automatable — the AE must approve before anything is sent.",
    x: 800, y: 700,
  },
  {
    ...SEED_DEFAULTS,
    libraryId: "lib-gtm-competitive",
    id: "lib-gtm-competitive",
    category: "gtm_operator",
    theme: "marketing",
    name: "Competitive intelligence digest",
    trigger: { type: "schedule", description: "Every Monday at 8am" },
    why: "Keep the team current on competitor moves without anyone manually combing news.",
    inputs: [
      { name: "Competitor list", source: "Notion" },
      { name: "Last week's digest", source: "Notion" },
    ],
    steps: [
      { n: 1, text: "Scan recent news on 5 competitors via Perplexity", automationPotential: "high" },
      { n: 2, text: "Summarise key moves and product updates", automationPotential: "high" },
      { n: 3, text: "Sense-check and add commentary", note: "Add strategic context before posting", automationPotential: "low" },
      { n: 4, text: "Post digest to #competitive Slack channel", automationPotential: "high" },
    ],
    outputs: [
      { name: "Weekly digest", source: "Slack" },
      { name: "Updated competitor log", source: "Notion" },
    ],
    tools: ["Perplexity", "Claude", "Notion", "Slack"],
    automationScore: 0,
    automationRationale: "Research and summarisation are automatable — a human should add strategic context before the team sees it.",
    x: 1600, y: 700,
  },
  // Standalone GTM workflow.
  {
    ...SEED_DEFAULTS,
    libraryId: "lib-gtm-campaign-launch",
    id: "lib-gtm-campaign-launch",
    category: "gtm_operator",
    theme: "marketing",
    name: "New marketing campaign launch",
    trigger: { type: "event", description: "Campaign brief approved in Notion" },
    why: "Get an approved campaign live the same day without the operator becoming a bottleneck.",
    inputs: [
      { name: "Campaign brief", source: "Notion" },
      { name: "Brand voice doc", source: "Notion" },
    ],
    steps: [
      { n: 1, text: "Create tracking links and UTMs", automationPotential: "high" },
      { n: 2, text: "Draft social copy variants in Claude", automationPotential: "high" },
      { n: 3, text: "Schedule posts in Buffer", automationPotential: "high" },
      { n: 4, text: "Create campaign in HubSpot with UTM parameters", automationPotential: "high" },
      { n: 5, text: "Notify team in Slack with campaign details", automationPotential: "high" },
    ],
    outputs: [
      { name: "Scheduled posts", source: "Buffer" },
      { name: "Campaign in HubSpot", source: "HubSpot" },
      { name: "Team notified", source: "Slack" },
    ],
    tools: ["Notion", "Claude", "Buffer", "HubSpot", "Slack"],
    automationScore: 0,
    automationRationale: "Fully automatable once the brief is approved — all execution steps are rule-based.",
    x: 2400, y: 700,
  },

  // ─── Category 3: Ops Manager ───────────────────────────────────────────
  // Chain "Client Ops Playbook" — 7, 8, 9 connected in sequence.
  {
    ...SEED_DEFAULTS,
    libraryId: "lib-ops-onboarding",
    id: "lib-ops-onboarding",
    category: "ops_manager",
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
      { n: 2, text: "Set up Slack channel and invite team", automationPotential: "high" },
      { n: 3, text: "Send welcome email with onboarding doc link", automationPotential: "high" },
      { n: 4, text: "Schedule kickoff call via Calendly", automationPotential: "high" },
      { n: 5, text: "Create onboarding project in Asana with default tasks", automationPotential: "high" },
      { n: 6, text: "Brief internal team in Slack with client context", note: "Add strategic context before sending", automationPotential: "medium" },
    ],
    outputs: [
      { name: "Client workspace", source: "Notion" },
      { name: "Slack channel", source: "Slack" },
      { name: "Welcome email sent", source: "Gmail" },
      { name: "Kickoff scheduled", source: "Calendly" },
      { name: "Asana project", source: "Asana" },
    ],
    tools: ["DocuSign", "Notion", "Slack", "Calendly", "Asana", "HubSpot"],
    automationScore: 0,
    automationRationale: "Almost fully automatable — only the internal team brief needs a human touch to add strategic context.",
    x: 0, y: 1400,
  },
  {
    ...SEED_DEFAULTS,
    libraryId: "lib-ops-health",
    id: "lib-ops-health",
    category: "ops_manager",
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
      { n: 3, text: "Check NPS scores from last 30 days", automationPotential: "high" },
      { n: 4, text: "Cross-reference with open support tickets in Intercom", automationPotential: "high" },
      { n: 5, text: "CSM reviews flagged accounts and decides action", note: "Prioritise and assign interventions", automationPotential: "low" },
      { n: 6, text: "Log health scores in HubSpot", automationPotential: "high" },
      { n: 7, text: "Send at-risk alerts to CSM Slack channel", automationPotential: "high" },
    ],
    outputs: [
      { name: "Health score log", source: "HubSpot" },
      { name: "At-risk alerts", source: "Slack" },
      { name: "CSM action list", source: "HubSpot" },
    ],
    tools: ["Mixpanel", "Intercom", "HubSpot", "Slack"],
    automationScore: 0,
    automationRationale: "Data aggregation and alerting are fully automatable — intervention decisions require CSM judgment.",
    x: 800, y: 1400,
  },
  {
    ...SEED_DEFAULTS,
    libraryId: "lib-ops-renewal",
    id: "lib-ops-renewal",
    category: "ops_manager",
    theme: "sales",
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
      { n: 2, text: "Identify expansion signals — seats, feature adoption, NPS", automationPotential: "high" },
      { n: 3, text: "Generate renewal talking points doc in Notion", automationPotential: "high" },
      { n: 4, text: "CSM reviews and adds relationship context", note: "Personalise based on relationship history", automationPotential: "low" },
      { n: 5, text: "Send renewal outreach email from HubSpot template", automationPotential: "high" },
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
    automationRationale: "Mostly automatable — the CSM must personalise based on relationship context before anything is sent.",
    x: 1600, y: 1400,
  },
  // Standalone Ops workflows.
  {
    ...SEED_DEFAULTS,
    libraryId: "lib-ops-board-report",
    id: "lib-ops-board-report",
    category: "ops_manager",
    theme: "operations",
    name: "Monthly board report",
    trigger: { type: "schedule", description: "Last Friday of every month" },
    why: "Hand the founder a draft board deck instead of a spreadsheet panic.",
    inputs: [
      { name: "Revenue", source: "Stripe" },
      { name: "Pipeline", source: "HubSpot" },
      { name: "NPS", source: "Delighted" },
      { name: "Product metrics", source: "Mixpanel" },
    ],
    steps: [
      { n: 1, text: "Pull revenue metrics from Stripe", automationPotential: "high" },
      { n: 2, text: "Pull pipeline data from HubSpot", automationPotential: "high" },
      { n: 3, text: "Pull NPS scores from Delighted", automationPotential: "high" },
      { n: 4, text: "Pull product metrics from Mixpanel", automationPotential: "high" },
      { n: 5, text: "Generate first draft in Google Slides using template", automationPotential: "medium" },
      { n: 6, text: "Founder reviews and adds commentary", note: "Add narrative and strategic context", automationPotential: "low" },
    ],
    outputs: [
      { name: "Draft board report", source: "Google Slides" },
    ],
    tools: ["Stripe", "HubSpot", "Delighted", "Mixpanel", "Claude", "Google Slides"],
    automationScore: 0,
    automationRationale: "Data aggregation and slide generation are automatable — the founder must add narrative before this goes to the board.",
    x: 2400, y: 1400,
  },
  {
    ...SEED_DEFAULTS,
    libraryId: "lib-ops-vendor-renewal",
    id: "lib-ops-vendor-renewal",
    category: "ops_manager",
    theme: "finance",
    name: "Vendor renewal tracker",
    trigger: { type: "event", description: "Contract renewal date within 60 days" },
    why: "Stop auto-renewing contracts you'd renegotiate or cancel if you remembered to look.",
    inputs: [
      { name: "Contract data", source: "Airtable" },
      { name: "Usage data", source: "Internal tools" },
    ],
    steps: [
      { n: 1, text: "Pull contract details from Airtable", automationPotential: "high" },
      { n: 2, text: "Generate usage and value summary", automationPotential: "high" },
      { n: 3, text: "Prompt ops lead to decide: renew / renegotiate / cancel", note: "Strategic decision — needs context", automationPotential: "low" },
      { n: 4, text: "Log decision and next steps in Airtable", automationPotential: "high" },
      { n: 5, text: "If renewing: initiate renewal with vendor via email", automationPotential: "high", isSensitive: true },
    ],
    outputs: [
      { name: "Decision logged", source: "Airtable" },
      { name: "Renewal initiated or cancelled", source: "Gmail" },
    ],
    tools: ["Airtable", "Claude", "Gmail"],
    automationScore: 0,
    automationRationale: "Data gathering is fully automatable — the renewal decision is a strategic call that needs a human.",
    x: 3200, y: 1400,
  },

  // ─── Category 4: E-commerce Ops ────────────────────────────────────────
  // Chain "Cart Recovery Engine" — 10, 11 connected in sequence.
  {
    ...SEED_DEFAULTS,
    libraryId: "lib-ecom-cart-call",
    id: "lib-ecom-cart-call",
    category: "ecommerce_ops",
    theme: "sales",
    name: "Abandoned cart outreach",
    trigger: { type: "event", description: "Customer abandons cart after 2-hour delay" },
    why: "Recover revenue from abandoned high-value carts and learn why they stalled.",
    inputs: [
      { name: "Abandoned cart data", source: "Shopify" },
      { name: "Customer phone number", source: "HubSpot" },
    ],
    steps: [
      { n: 1, text: "Detect abandonment in Shopify above configurable threshold", automationPotential: "high" },
      { n: 2, text: "Check if customer has phone number on file", automationPotential: "high" },
      { n: 3, text: "Assign outreach to next available team member via Slack", automationPotential: "high" },
      { n: 4, text: "Call customer to check for issues or offer phone order", note: "Human call — judgment and relationship required", automationPotential: "low", isSensitive: true },
      { n: 5, text: "Log call outcome in CRM: completed / follow-up needed / declined / no answer", automationPotential: "high" },
      { n: 6, text: "If order completed by phone: create manual order in Shopify and send confirmation", automationPotential: "high", isSensitive: true },
      { n: 7, text: "If unresolved: add to email re-engagement sequence", automationPotential: "high" },
    ],
    outputs: [
      { name: "Call outcome logged", source: "HubSpot" },
      { name: "Order created if applicable", source: "Shopify" },
      { name: "Follow-up triggered if needed", source: "Klaviyo" },
    ],
    tools: ["Shopify", "HubSpot", "Slack", "Aircall", "Klaviyo"],
    automationScore: 0,
    automationRationale: "Routing and logging are fully automatable — the call itself is human-only and order creation is a sensitive consequential action.",
    x: 0, y: 2100,
  },
  {
    ...SEED_DEFAULTS,
    libraryId: "lib-ecom-recovery-digest",
    id: "lib-ecom-recovery-digest",
    category: "ecommerce_ops",
    theme: "operations",
    name: "Weekly cart recovery digest",
    trigger: { type: "schedule", description: "Every Monday at 9am" },
    why: "Turn last week's recovery calls into a weekly read on friction, recovery rate, and product signal.",
    inputs: [
      { name: "Call outcomes", source: "HubSpot" },
      { name: "Call recordings", source: "Aircall" },
      { name: "Previous digest", source: "Notion" },
    ],
    steps: [
      { n: 1, text: "Pull all call outcomes from CRM for past 7 days", automationPotential: "high" },
      { n: 2, text: "Pull call recordings from Aircall", automationPotential: "high" },
      { n: 3, text: "Transcribe recordings using AI", automationPotential: "high" },
      { n: 4, text: "Categorise friction signals: payment / UX / price / competitor / other", automationPotential: "high" },
      { n: 5, text: "Calculate recovery rate for the week", automationPotential: "high" },
      { n: 6, text: "Generate weekly digest — top friction themes, recovery rate, notable quotes", note: "Sense-check before posting", automationPotential: "medium" },
      { n: 7, text: "Post digest to #ecommerce-ops Slack channel", automationPotential: "high" },
    ],
    outputs: [
      { name: "Weekly digest", source: "Slack" },
      { name: "Friction signal log", source: "Notion" },
      { name: "Recovery rate metric", source: "Notion" },
    ],
    tools: ["HubSpot", "Aircall", "Claude", "Notion", "Slack"],
    automationScore: 0,
    automationRationale: "Fully automatable except the digest summary which benefits from a human sense-check — the output improves week on week as patterns emerge.",
    x: 800, y: 2100,
  },
];

// Default user canvas that ships empty for new accounts. Renamed from
// "My Business" to "My Workflows" — broader and inclusive of solo
// users, creators, and personal automation, not just companies.
export const myWorkflowsCanvas: Canvas = {
  id: DEFAULT_CANVAS_ID,
  name: "My Workflows",
  workflowIds: [],
  connections: [],
  chainNames: {},
};

// Read-only Library canvas containing the seeded templates. Sidebar
// labels read "Library"; the canvas id keeps its legacy
// "canvas-examples" string so stored activeCanvasId records still
// resolve correctly after the rename.
export const libraryCanvas: Canvas = {
  id: LIBRARY_CANVAS_ID,
  name: "Library",
  workflowIds: initialWorkflows.map((w) => w.id),
  // Each chain is a connected component on this canvas (computeChains
  // groups them automatically). Labels carry meaning where one
  // workflow leads logically into the next; chains without a hand-off
  // narrative stay unlabelled.
  connections: [
    // Solo Founder Playbook
    { from: "lib-founder-triage", to: "lib-founder-content" },
    { from: "lib-founder-content", to: "lib-founder-invoicing" },
    // GTM Engine
    { from: "lib-gtm-lead-to-call", to: "lib-gtm-post-demo" },
    { from: "lib-gtm-post-demo", to: "lib-gtm-competitive" },
    // Client Ops Playbook
    { from: "lib-ops-onboarding", to: "lib-ops-health", label: "Once onboarded" },
    { from: "lib-ops-health", to: "lib-ops-renewal", label: "If healthy" },
    // Cart Recovery Engine
    { from: "lib-ecom-cart-call", to: "lib-ecom-recovery-digest" },
  ],
  // chainNames key = chainKey(ids) = sorted ids joined with '|'.
  chainNames: {
    "lib-founder-content|lib-founder-invoicing|lib-founder-triage": "Solo Founder Playbook",
    "lib-gtm-competitive|lib-gtm-lead-to-call|lib-gtm-post-demo": "GTM Engine",
    "lib-ops-health|lib-ops-onboarding|lib-ops-renewal": "Client Ops Playbook",
    "lib-ecom-cart-call|lib-ecom-recovery-digest": "Cart Recovery Engine",
  },
  readOnly: true,
};
