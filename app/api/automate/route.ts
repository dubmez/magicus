import Anthropic from "@anthropic-ai/sdk";
import { type NextRequest, NextResponse } from "next/server";
import type { Workflow, Connection } from "@/lib/workflows";

const client = new Anthropic();

const SYSTEM = `You are an automation consultant who creates clear, actionable automation instructions.
Given one or more business workflows, you generate step-by-step automation setup guides for a specific platform.
Be concrete and practical. Assume the user has access to the platform but may not be an expert.
List exact steps, triggers, actions, and any field mappings where relevant.
Keep your response focused and scannable — use numbered steps and short paragraphs.`;

type Body = {
  workflows: Workflow[];
  connections: Connection[];
  platform: "zapier" | "n8n";
};

export async function POST(req: NextRequest) {
  try {
    const { workflows, connections, platform } = (await req.json()) as Body;

    const workflowSummary = workflows
      .map((w) => {
        const chainedTo = connections
          .filter((c) => c.from === w.id)
          .map((c) => workflows.find((x) => x.id === c.to)?.name)
          .filter(Boolean);
        return [
          `## ${w.name}`,
          `Owner: ${w.owner} | Trigger: ${w.frequency} | Theme: ${w.theme}`,
          `Why: ${w.why}`,
          `When: ${w.when}`,
          `Inputs: ${w.inputs.map((i) => `${i.name} (${i.source})`).join(", ")}`,
          `Tasks: ${w.tasks.map((t) => `${t.n}. ${t.text}${t.note ? ` [${t.note}]` : ""}`).join(" → ")}`,
          `Outputs: ${w.outputs.map((o) => `${o.name} (${o.source})`).join(", ")}`,
          `Tools: ${w.tools.join(", ")}`,
          `Automation score: ${w.automationScore}%`,
          chainedTo.length > 0 ? `Chains to: ${chainedTo.join(", ")}` : null,
        ]
          .filter(Boolean)
          .join("\n");
      })
      .join("\n\n");

    const label = platform === "zapier" ? "Zapier" : "n8n";
    const plural = workflows.length > 1;

    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      system: [
        {
          type: "text",
          text: SYSTEM,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [
        {
          role: "user",
          content: `Generate ${label} automation instructions for the following workflow${plural ? "s" : ""}:\n\n${workflowSummary}\n\nProvide step-by-step instructions to automate ${plural ? "these workflows" : "this"} in ${label}. Be specific about triggers, actions, and any field mappings needed.`,
        },
      ],
    });

    const text = response.content.find((b) => b.type === "text")?.text ?? "";
    return NextResponse.json({ instructions: text });
  } catch (err) {
    console.error("[automate]", err);
    return NextResponse.json({ error: "Failed to generate instructions" }, { status: 500 });
  }
}
