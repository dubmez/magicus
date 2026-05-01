import Anthropic from "@anthropic-ai/sdk";
import { type NextRequest, NextResponse } from "next/server";

const client = new Anthropic();

const SYSTEM = `You convert a user's rough description of a business workflow into a structured workflow card (or chain of cards if appropriate).

The user's description is the source of truth. Do not invent details they did not provide. When in doubt, leave fields empty rather than guessing.

Rules:
1. Extract every concrete detail the user mentioned — specific tools, people, frequencies, conditions, triggers — and use them VERBATIM in the generated card. Do not paraphrase, generalise, or substitute generic equivalents.
2. Preserve specificity in step text. If the user said "check eligibility against the refund policy doc in Notion", the step should say exactly that — not "verify request" or "review eligibility".
3. Only infer fields the user did not specify. When inferring, be conservative: prefer fewer steps and fewer tools over plausible-sounding generic content. It is better to leave a field empty than to fill it with a guess.
4. Empty fields are fine — empty trigger, empty step owners, empty notes. The UI prompts the user to fill them in. Do not pad.
5. Decide between one workflow vs a chain:
   - If the description has multiple distinct stages with different triggers OR clear handoffs between teams/systems, generate multiple connected workflow cards forming a chain.
   - If it's a single coherent process, generate ONE card.
   - Err toward fewer cards when uncertain.
6. When generating a chain, the FIRST workflow keeps its real trigger (schedule/event/manual). Downstream workflows in the chain MUST have trigger.type = "chained" and no description, since the connection itself is the trigger. Use the connection's "label" to describe the handoff (e.g. "Lead qualified", "Draft approved").
7. Theme must be one of: sales, marketing, operations, finance. Pick based on the workflow's domain.
8. automationScore is a 0-100 estimate of how much of this workflow could realistically be automated. Be honest — work that requires human judgement should score lower.

Use the generate_workflows tool to return your output. Do not include any prose outside the tool call.`;

type GeneratedTrigger =
  | { type: "schedule" | "event" | "manual" | "chained"; description?: string }
  | null;

type GeneratedWorkflow = {
  id: string;
  theme: "sales" | "marketing" | "operations" | "finance";
  name: string;
  trigger: GeneratedTrigger;
  why: string;
  inputs: { name: string; source: string }[];
  steps: { n: number; text: string; note?: string; owner?: string }[];
  outputs: { name: string; source: string }[];
  tools: string[];
  automationScore: number;
  automationRationale: string;
};

type GeneratedConnection = { from: string; to: string; label?: string };

type ToolInput = {
  workflows: GeneratedWorkflow[];
  connections: GeneratedConnection[];
};

const tool = {
  name: "generate_workflows",
  description:
    "Output one or more structured workflow cards (and connections between them, if a chain) based on the user's description.",
  input_schema: {
    type: "object" as const,
    properties: {
      workflows: {
        type: "array",
        description: "One or more workflow cards. Use multiple only when the description clearly has distinct stages with handoffs.",
        items: {
          type: "object",
          properties: {
            id: {
              type: "string",
              description: "Short local identifier used to reference this workflow in connections (e.g. 'a', 'b', 'c').",
            },
            theme: {
              type: "string",
              enum: ["sales", "marketing", "operations", "finance"],
            },
            name: {
              type: "string",
              description: "A short, specific name (under 60 chars) drawn from the user's description.",
            },
            trigger: {
              type: ["object", "null"],
              description: "What kicks the workflow off. Null if the user did not mention a trigger.",
              properties: {
                type: {
                  type: "string",
                  enum: ["schedule", "event", "manual", "chained"],
                },
                description: {
                  type: "string",
                  description: "Verbatim from the user when possible. Omit for type=chained.",
                },
              },
              required: ["type"],
            },
            why: {
              type: "string",
              description: "Why the workflow exists. Drawn from the user's description; empty string if they didn't say.",
            },
            inputs: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  source: { type: "string" },
                },
                required: ["name", "source"],
              },
            },
            steps: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  n: { type: "number" },
                  text: { type: "string", description: "Verbatim from the user when possible." },
                  note: { type: "string", description: "Conditional or branching detail (e.g. 'If discount > 15%, escalate'). Omit when absent." },
                  owner: { type: "string", description: "Person or team responsible. Omit if the user didn't say." },
                },
                required: ["n", "text"],
              },
            },
            outputs: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  source: { type: "string" },
                },
                required: ["name", "source"],
              },
            },
            tools: {
              type: "array",
              description: "Specific tools the user mentioned. Empty array is fine if they didn't name any.",
              items: { type: "string" },
            },
            automationScore: {
              type: "number",
              minimum: 0,
              maximum: 100,
            },
            automationRationale: { type: "string" },
          },
          required: [
            "id",
            "theme",
            "name",
            "trigger",
            "why",
            "inputs",
            "steps",
            "outputs",
            "tools",
            "automationScore",
            "automationRationale",
          ],
        },
      },
      connections: {
        type: "array",
        description: "Edges between workflow ids. Empty when there is only one workflow.",
        items: {
          type: "object",
          properties: {
            from: { type: "string" },
            to: { type: "string" },
            label: { type: "string", description: "Short handoff label, e.g. 'Lead qualified'." },
          },
          required: ["from", "to"],
        },
      },
    },
    required: ["workflows", "connections"],
  },
};

export async function POST(req: NextRequest) {
  try {
    const { description } = (await req.json()) as { description: string };
    if (!description || description.trim().length === 0) {
      return NextResponse.json({ error: "Empty description" }, { status: 400 });
    }

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2000,
      system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
      tools: [tool],
      tool_choice: { type: "tool", name: "generate_workflows" },
      messages: [
        {
          role: "user",
          content: `User description:\n\n"""${description.trim()}"""`,
        },
      ],
    });

    const toolUse = response.content.find((b) => b.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") {
      return NextResponse.json({ error: "Model did not return a tool call" }, { status: 502 });
    }

    const data = toolUse.input as ToolInput;
    return NextResponse.json(data);
  } catch (err) {
    console.error("[generate]", err);
    return NextResponse.json({ error: "Failed to generate workflow" }, { status: 500 });
  }
}
