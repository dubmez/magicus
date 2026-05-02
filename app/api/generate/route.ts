import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI, Type } from "@google/genai";
import { type NextRequest, NextResponse } from "next/server";

// Provider dispatch — same pattern as /api/automate. Gemini 2.5 Flash is
// substantially cheaper for this template-shaped output. Set
// MAGICUS_GENERATE_PROVIDER=anthropic to flip back without a code change.
type Provider = "gemini" | "anthropic";
function pickProvider(): Provider {
  const v = (process.env.MAGICUS_GENERATE_PROVIDER ?? "gemini").toLowerCase();
  return v === "anthropic" ? "anthropic" : "gemini";
}

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
9. For each step, set "classification" to one of:
   - "automate" — rule-based, safe for an agent to handle (e.g. parsing, scheduling, logging, sending templated messages)
   - "human_review" — judgment is required (e.g. evaluating fit, drafting custom outreach, exceptions)
   - "security_risk" — sensitive data or consequential actions (e.g. moving money, granting access, sending invoices)
   - "needs_standardisation" — too variable across runs to automate reliably without further process work
   Be honest. Most workflows have a mix. If unsure between automate and human_review, prefer human_review.

Return the structured workflow object. Do not include prose outside the structured response.`;

type GeneratedTrigger =
  | { type: "schedule" | "event" | "manual" | "chained"; description?: string }
  | null;

type GeneratedClassification =
  | "automate"
  | "human_review"
  | "security_risk"
  | "needs_standardisation";

type GeneratedWorkflow = {
  id: string;
  theme: "sales" | "marketing" | "operations" | "finance";
  name: string;
  trigger: GeneratedTrigger;
  why: string;
  inputs: { name: string; source: string }[];
  steps: {
    n: number;
    text: string;
    note?: string;
    owner?: string;
    classification?: GeneratedClassification;
  }[];
  outputs: { name: string; source: string }[];
  tools: string[];
  automationScore: number;
  automationRationale: string;
};

type GeneratedConnection = { from: string; to: string; label?: string };

type GenerateResponse = {
  workflows: GeneratedWorkflow[];
  connections: GeneratedConnection[];
};

// ─── Anthropic schema (tool input) ─────────────────────────────────────────
const anthropicTool = {
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
            id: { type: "string", description: "Short local id (e.g. 'a', 'b')." },
            theme: { type: "string", enum: ["sales", "marketing", "operations", "finance"] },
            name: { type: "string", description: "Short, specific name (under 60 chars)." },
            trigger: {
              type: ["object", "null"],
              properties: {
                type: { type: "string", enum: ["schedule", "event", "manual", "chained"] },
                description: { type: "string" },
              },
              required: ["type"],
            },
            why: { type: "string" },
            inputs: {
              type: "array",
              items: {
                type: "object",
                properties: { name: { type: "string" }, source: { type: "string" } },
                required: ["name", "source"],
              },
            },
            steps: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  n: { type: "number" },
                  text: { type: "string" },
                  note: { type: "string" },
                  owner: { type: "string" },
                  classification: {
                    type: "string",
                    enum: ["automate", "human_review", "security_risk", "needs_standardisation"],
                  },
                },
                required: ["n", "text", "classification"],
              },
            },
            outputs: {
              type: "array",
              items: {
                type: "object",
                properties: { name: { type: "string" }, source: { type: "string" } },
                required: ["name", "source"],
              },
            },
            tools: { type: "array", items: { type: "string" } },
            automationScore: { type: "number", minimum: 0, maximum: 100 },
            automationRationale: { type: "string" },
          },
          required: [
            "id", "theme", "name", "trigger", "why", "inputs",
            "steps", "outputs", "tools", "automationScore", "automationRationale",
          ],
        },
      },
      connections: {
        type: "array",
        items: {
          type: "object",
          properties: {
            from: { type: "string" },
            to: { type: "string" },
            label: { type: "string" },
          },
          required: ["from", "to"],
        },
      },
    },
    required: ["workflows", "connections"],
  },
};

// ─── Gemini schema (responseSchema) — same shape, Gemini's Type enum ───────
const geminiSchema = {
  type: Type.OBJECT,
  properties: {
    workflows: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          theme: {
            type: Type.STRING,
            enum: ["sales", "marketing", "operations", "finance"],
          },
          name: { type: Type.STRING },
          trigger: {
            type: Type.OBJECT,
            nullable: true,
            properties: {
              type: {
                type: Type.STRING,
                enum: ["schedule", "event", "manual", "chained"],
              },
              description: { type: Type.STRING, nullable: true },
            },
            required: ["type"],
          },
          why: { type: Type.STRING },
          inputs: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                source: { type: Type.STRING },
              },
              required: ["name", "source"],
            },
          },
          steps: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                n: { type: Type.INTEGER },
                text: { type: Type.STRING },
                note: { type: Type.STRING, nullable: true },
                owner: { type: Type.STRING, nullable: true },
                classification: {
                  type: Type.STRING,
                  enum: ["automate", "human_review", "security_risk", "needs_standardisation"],
                },
              },
              required: ["n", "text", "classification"],
            },
          },
          outputs: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                source: { type: Type.STRING },
              },
              required: ["name", "source"],
            },
          },
          tools: { type: Type.ARRAY, items: { type: Type.STRING } },
          automationScore: { type: Type.INTEGER },
          automationRationale: { type: Type.STRING },
        },
        required: [
          "id", "theme", "name", "trigger", "why", "inputs",
          "steps", "outputs", "tools", "automationScore", "automationRationale",
        ],
      },
    },
    connections: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          from: { type: Type.STRING },
          to: { type: Type.STRING },
          label: { type: Type.STRING, nullable: true },
        },
        required: ["from", "to"],
      },
    },
  },
  required: ["workflows", "connections"],
};

async function generateWithAnthropic(description: string): Promise<GenerateResponse | null> {
  const client = new Anthropic();
  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2000,
    system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
    tools: [anthropicTool],
    tool_choice: { type: "tool", name: "generate_workflows" },
    messages: [
      { role: "user", content: `User description:\n\n"""${description.trim()}"""` },
    ],
  });
  const toolUse = response.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") return null;
  return toolUse.input as GenerateResponse;
}

async function generateWithGemini(description: string): Promise<GenerateResponse | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
  const client = new GoogleGenAI({ apiKey });
  const response = await client.models.generateContent({
    model: "gemini-2.5-flash",
    config: {
      systemInstruction: SYSTEM,
      responseMimeType: "application/json",
      responseSchema: geminiSchema,
      maxOutputTokens: 4000,
    },
    contents: `User description:\n\n"""${description.trim()}"""`,
  });
  const text = response.text;
  if (!text) return null;
  try {
    return JSON.parse(text) as GenerateResponse;
  } catch (err) {
    console.error("[generate/gemini] JSON parse failed", err, text.slice(0, 400));
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const { description } = (await req.json()) as { description: string };
    if (!description || description.trim().length === 0) {
      return NextResponse.json({ error: "Empty description" }, { status: 400 });
    }

    const provider = pickProvider();
    const data =
      provider === "gemini"
        ? await generateWithGemini(description)
        : await generateWithAnthropic(description);

    if (!data || !Array.isArray(data.workflows) || data.workflows.length === 0) {
      return NextResponse.json(
        { error: "Model returned no usable workflows" },
        { status: 502 }
      );
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error("[generate]", err);
    return NextResponse.json({ error: "Failed to generate workflow" }, { status: 500 });
  }
}
