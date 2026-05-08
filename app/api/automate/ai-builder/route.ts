import { GoogleGenAI } from "@google/genai";
import { type NextRequest, NextResponse } from "next/server";
import type { Workflow, Connection } from "@/lib/workflows";
import { withRetry } from "@/lib/retry";

// AI-Builder prompt generator. Returns a single plain-text paragraph the
// user pastes into n8n's native "Build with AI" input. Different surface
// from /api/automate (which returns step-by-step Markdown instructions),
// so the system prompt and output shape diverge — separate route keeps
// each contract clean.

const MAX_OUTPUT_TOKENS = 800;

const SYSTEM = `You are helping a user build an automation in n8n using n8n's native AI workflow builder. Your job is to write a clear, natural language prompt they can paste directly into n8n's 'Build with AI' input box.
The prompt you write should:
- Open with a one-sentence description of what the workflow does and what triggers it
- Describe each step in plain language, in order, mentioning the specific tools and apps involved
- Include any important conditions, branches, or decision points (e.g. 'if the score is above 7, proceed — otherwise stop')
- Mention what the final output or outcome is
- Be written as a direct instruction to n8n's AI builder — e.g. 'Build a workflow that...' or 'Create an n8n workflow that...'
- Be specific enough that n8n can select appropriate nodes and connections, but not so prescriptive that it specifies exact node types or parameter names
- Be between 100 and 250 words — detailed enough to be useful, short enough to be readable
Do not include:
- Any preamble or explanation ('Here is your prompt:', 'This prompt will...')
- Markdown formatting, headers, or bullet points — plain paragraph text only
- Technical n8n terminology like node names, typeVersions, or JSON
- Advice or commentary — just the prompt itself
Write only the prompt. Nothing else.`;

type Body = {
  workflows: Workflow[];
  connections: Connection[];
};

function buildContext(workflows: Workflow[], connections: Connection[]): string {
  const blocks = workflows.map((w) => {
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
      `Workflow: ${w.name}`,
      `Purpose: ${w.why}`,
      `Trigger: ${triggerLabel}`,
      `Inputs: ${w.inputs.map((i) => `${i.name} (from ${i.source})`).join(", ") || "—"}`,
      `Steps:\n${w.steps
        .map((t) => `  ${t.n}. ${t.text}${t.note ? ` — ${t.note}` : ""}${t.owner ? ` [${t.owner}]` : ""}`)
        .join("\n")}`,
      `Outputs: ${w.outputs.map((o) => `${o.name} (${o.source})`).join(", ") || "—"}`,
      `Tools: ${w.tools.join(", ") || "—"}`,
      `Automation potential: ${w.automationScore}%`,
      chainedTo.length > 0 ? `Chains to: ${chainedTo.join(", ")}` : null,
    ]
      .filter(Boolean)
      .join("\n");
  });

  const chainNote =
    workflows.length > 1
      ? "\n\nThe user has selected multiple workflows that form a chain. Generate a single prompt that covers the full chain in order — do not produce one prompt per workflow."
      : "";

  return `Generate the n8n AI-builder prompt for the following workflow${
    workflows.length > 1 ? "s" : ""
  }:\n\n${blocks.join("\n\n---\n\n")}${chainNote}`;
}

export async function POST(req: NextRequest) {
  try {
    const { workflows, connections } = (await req.json()) as Body;
    if (!workflows || workflows.length === 0) {
      return NextResponse.json({ error: "No workflows provided" }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
    const client = new GoogleGenAI({ apiKey });

    const userPrompt = buildContext(workflows, connections);
    const response = await withRetry(() =>
      client.models.generateContent({
        model: "gemini-2.5-flash",
        config: {
          systemInstruction: SYSTEM,
          maxOutputTokens: MAX_OUTPUT_TOKENS,
        },
        contents: userPrompt,
      })
    );

    const text = (response.text ?? "").trim();
    if (!text) {
      return NextResponse.json({ error: "Empty response from model" }, { status: 502 });
    }
    return NextResponse.json({ prompt: text });
  } catch (err) {
    console.error("[automate/ai-builder]", err);
    return NextResponse.json(
      { error: "Failed to generate AI builder prompt" },
      { status: 500 }
    );
  }
}
