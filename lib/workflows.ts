export type Theme = "sales" | "marketing" | "operations" | "finance";

export type IOItem = { name: string; source: string };
export type Task = { n: number; text: string; note?: string };

export type Workflow = {
  id: string;
  theme: Theme;
  name: string;
  owner: string;
  frequency: string;
  why: string;
  when: string;
  inputs: IOItem[];
  tasks: Task[];
  outputs: IOItem[];
  tools: string[];
  automationScore: number;
  automationRationale: string;
  x: number;
  y: number;
};

export type Connection = { from: string; to: string; label?: string };

export const THEME_META: Record<Theme, { label: string; dot: string }> = {
  sales: { label: "Sales", dot: "#547863" },
  marketing: { label: "Marketing", dot: "#C99461" },
  operations: { label: "Operations", dot: "#6B8AB8" },
  finance: { label: "Finance", dot: "#B5894C" },
};

export const initialWorkflows: Workflow[] = [
  {
    id: "qual",
    theme: "sales",
    name: "Inbound lead qualification",
    owner: "Sales lead",
    frequency: "Per event",
    why: "Surface high-fit leads quickly so reps spend time on the right accounts.",
    when: "Triggered whenever a new lead form is submitted on the website.",
    inputs: [
      { name: "Lead form data", source: "Website" },
      { name: "ICP criteria", source: "Notion" },
    ],
    tasks: [
      { n: 1, text: "Receive inbound lead" },
      { n: 2, text: "Score against ICP", note: "If score > 7, proceed" },
      { n: 3, text: "Send personalised outreach" },
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
    owner: "AE",
    frequency: "Per lead",
    why: "Understand the prospect's pain before pitching to avoid wasted cycles.",
    when: "After a lead is marked qualified.",
    inputs: [
      { name: "Qualified lead", source: "HubSpot" },
      { name: "Discovery script", source: "Notion" },
    ],
    tasks: [
      { n: 1, text: "Schedule call" },
      { n: 2, text: "Run discovery", note: "If budget confirmed, advance" },
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
    owner: "Solutions",
    frequency: "Per opportunity",
    why: "Send tailored proposals fast while keeping margin within guardrails.",
    when: "After a discovery call confirms fit and budget.",
    inputs: [
      { name: "Discovery notes", source: "HubSpot" },
      { name: "Pricing matrix", source: "Sheets" },
    ],
    tasks: [
      { n: 1, text: "Draft proposal" },
      { n: 2, text: "Internal review", note: "If discount > 15%, escalate" },
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
    owner: "AE + CSM",
    frequency: "Per win",
    why: "Move customers from sales to success without dropped context.",
    when: "When a proposal is signed.",
    inputs: [
      { name: "Signed proposal", source: "DocuSign" },
      { name: "Onboarding template", source: "Notion" },
    ],
    tasks: [
      { n: 1, text: "Mark deal closed-won" },
      { n: 2, text: "Trigger invoice", note: "If annual, send PO request" },
      { n: 3, text: "Kick off onboarding" },
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
    owner: "Content lead",
    frequency: "Weekly",
    why: "Keep audience engaged with consistent value-led touchpoints.",
    when: "Every Thursday at 9am local.",
    inputs: [
      { name: "Editorial calendar", source: "Notion" },
      { name: "Subscriber list", source: "Mailchimp" },
    ],
    tasks: [
      { n: 1, text: "Compile stories" },
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
    owner: "Editor",
    frequency: "Per piece",
    why: "Ship high-quality content without bottlenecks at review.",
    when: "When a draft is moved to Ready-for-edit.",
    inputs: [
      { name: "Draft article", source: "Google Docs" },
      { name: "Style guide", source: "Notion" },
    ],
    tasks: [
      { n: 1, text: "Editorial review" },
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
    owner: "Ops manager",
    frequency: "Per vendor",
    why: "Get vendors set up cleanly so payments and access don't stall.",
    when: "When a new vendor is added in procurement.",
    inputs: [
      { name: "Vendor request", source: "Airtable" },
      { name: "Compliance checklist", source: "Notion" },
    ],
    tasks: [
      { n: 1, text: "Verify documents" },
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
    owner: "Finance ops",
    frequency: "Daily",
    why: "Pay vendors on time without rubber-stamping unauthorized spend.",
    when: "When an invoice is uploaded to the inbox.",
    inputs: [
      { name: "Invoice PDF", source: "Email" },
      { name: "Approval matrix", source: "Sheets" },
    ],
    tasks: [
      { n: 1, text: "Parse invoice fields" },
      { n: 2, text: "Route for approval", note: "If > $5k, dual approval" },
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

export const initialConnections: Connection[] = [
  { from: "qual", to: "discovery", label: "Qualified lead" },
  { from: "discovery", to: "proposal", label: "Discovery complete" },
  { from: "proposal", to: "close", label: "Proposal signed" },
];
