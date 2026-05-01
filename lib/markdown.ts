import type { Workflow, Trigger } from "./workflows";

function formatTrigger(trigger: Trigger | null): string {
  if (!trigger) return "Not yet defined";
  if (trigger.type === "chained") return "Triggered by an upstream workflow";
  const label = trigger.type.charAt(0).toUpperCase() + trigger.type.slice(1);
  return trigger.description ? `${label} — ${trigger.description}` : label;
}

export function workflowToMarkdown(w: Workflow): string {
  const inputs = w.inputs.map((i) => `- **${i.name}** _(${i.source})_`).join("\n");
  const outputs = w.outputs.map((o) => `- **${o.name}** _(${o.source})_`).join("\n");
  const steps = w.steps
    .map((t) => {
      let line = `${t.n}. ${t.text}`;
      if (t.note) line += `\n   > _${t.note}_`;
      if (t.owner) line += `\n   > Owner: ${t.owner}`;
      return line;
    })
    .join("\n");
  const tools = w.tools.map((t) => `\`${t}\``).join(" · ");

  return `# ${w.name}

**Theme:** ${w.theme}  •  **Trigger:** ${formatTrigger(w.trigger)}

## Purpose
${w.why}

## Inputs
${inputs}

## Steps
${steps}

## Outputs
${outputs}

## Tools
${tools}

## Automation potential
**${w.automationScore}%** — ${w.automationRationale}

---

## Automation prompt (for Claude Routines / n8n)

\`\`\`
You are setting up an automated routine for the workflow "${w.name}".

Trigger: ${formatTrigger(w.trigger)}
Inputs:
${w.inputs.map((i) => `  - ${i.name} (from ${i.source})`).join("\n")}

Steps:
${w.steps
  .map((t) => `  ${t.n}. ${t.text}${t.note ? ` — ${t.note}` : ""}${t.owner ? ` (owner: ${t.owner})` : ""}`)
  .join("\n")}

Outputs:
${w.outputs.map((o) => `  - ${o.name} (to ${o.source})`).join("\n")}

Tools available: ${w.tools.join(", ")}

Build this as a deterministic routine. Surface a human approval step wherever
the workflow includes a conditional note. Log every run for review.
\`\`\`
`;
}

export function allWorkflowsToMarkdown(ws: Workflow[]): string {
  return `# Magicus workflow export\n\n${ws.length} workflows mapped.\n\n---\n\n${ws
    .map((w) => workflowToMarkdown(w))
    .join("\n\n---\n\n")}`;
}
