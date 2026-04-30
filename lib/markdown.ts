import type { Workflow } from "./workflows";

export function workflowToMarkdown(w: Workflow): string {
  const inputs = w.inputs.map((i) => `- **${i.name}** _(${i.source})_`).join("\n");
  const outputs = w.outputs.map((o) => `- **${o.name}** _(${o.source})_`).join("\n");
  const tasks = w.tasks
    .map((t) => `${t.n}. ${t.text}${t.note ? `\n   > _${t.note}_` : ""}`)
    .join("\n");
  const tools = w.tools.map((t) => `\`${t}\``).join(" · ");

  return `# ${w.name}

**Theme:** ${w.theme}  •  **Owner:** ${w.owner}  •  **Frequency:** ${w.frequency}

## Why
${w.why}

## When
${w.when}

## Inputs
${inputs}

## Tasks
${tasks}

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

Trigger: ${w.when}
Owner of the routine: ${w.owner}
Inputs:
${w.inputs.map((i) => `  - ${i.name} (from ${i.source})`).join("\n")}

Steps:
${w.tasks.map((t) => `  ${t.n}. ${t.text}${t.note ? ` — ${t.note}` : ""}`).join("\n")}

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
