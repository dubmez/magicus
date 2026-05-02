import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI } from "@google/genai";
import { type NextRequest, NextResponse } from "next/server";
import type { Workflow, Connection } from "@/lib/workflows";

// Provider dispatch is server-only and env-driven so we can flip without a
// code change. Gemini 2.5 Flash is roughly 5× cheaper on output for this
// route's long markdown responses; Anthropic stays as a fallback if quality
// regresses on a specific workflow shape.
//   MAGICUS_AUTOMATE_PROVIDER=gemini      (default)
//   MAGICUS_AUTOMATE_PROVIDER=anthropic
type Provider = "gemini" | "anthropic";
function pickProvider(): Provider {
  const v = (process.env.MAGICUS_AUTOMATE_PROVIDER ?? "gemini").toLowerCase();
  return v === "anthropic" ? "anthropic" : "gemini";
}

// Bumped from 1000 → 4000 because real Zapier responses run several thousand
// tokens (prereq checklist, multiple step blocks, branching logic).
const MAX_OUTPUT_TOKENS = 4000;

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

function buildUserPrompt(
  workflows: Workflow[],
  connections: Connection[],
  platform: "zapier" | "n8n"
): string {
  const workflowSummary = workflows
    .map((w) => {
      const chainedTo = connections
        .filter((c) => c.from === w.id)
        .map((c) => workflows.find((x) => x.id === c.to)?.name)
        .filter(Boolean);
      const triggerLabel = w.trigger
        ? w.trigger.type === "chained"
          ? "Triggered by upstream workflow"
          : `${w.trigger.type}${w.trigger.description ? ` — ${w.trigger.description}` : ""}`
        : "Not yet defined";
      return [
        `## ${w.name}`,
        `Theme: ${w.theme} | Trigger: ${triggerLabel}`,
        `Purpose: ${w.why}`,
        `Inputs: ${w.inputs.map((i) => `${i.name} (${i.source})`).join(", ")}`,
        `Steps: ${w.steps.map((t) => `${t.n}. ${t.text}${t.note ? ` [${t.note}]` : ""}${t.owner ? ` (${t.owner})` : ""}`).join(" → ")}`,
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

  return `Generate ${label} automation instructions for the following workflow${plural ? "s" : ""}:\n\n${workflowSummary}\n\nProvide step-by-step instructions to automate ${plural ? "these workflows" : "this"} in ${label}. Be specific about triggers, actions, and any field mappings needed.`;
}

async function generateWithAnthropic(userPrompt: string): Promise<string> {
  const client = new Anthropic();
  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: MAX_OUTPUT_TOKENS,
    system: [
      { type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } },
    ],
    messages: [{ role: "user", content: userPrompt }],
  });
  return response.content.find((b) => b.type === "text")?.text ?? "";
}

async function generateWithGemini(userPrompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
  const client = new GoogleGenAI({ apiKey });
  const response = await client.models.generateContent({
    model: "gemini-2.5-flash",
    // Gemini's "system" lives inside config.systemInstruction; the user
    // content is plain text. We don't need structured output here — the
    // response is markdown the client renders directly.
    config: {
      systemInstruction: SYSTEM,
      maxOutputTokens: MAX_OUTPUT_TOKENS,
    },
    contents: userPrompt,
  });
  return response.text ?? "";
}

export async function POST(req: NextRequest) {
  try {
    const { workflows, connections, platform } = (await req.json()) as Body;
    const userPrompt = buildUserPrompt(workflows, connections, platform);

    const provider = pickProvider();
    const text =
      provider === "gemini"
        ? await generateWithGemini(userPrompt)
        : await generateWithAnthropic(userPrompt);

    if (!text) {
      return NextResponse.json(
        { error: "Empty response from model" },
        { status: 502 }
      );
    }
    return NextResponse.json({ instructions: text });
  } catch (err) {
    console.error("[automate]", err);
    return NextResponse.json(
      { error: "Failed to generate instructions" },
      { status: 500 }
    );
  }
}
