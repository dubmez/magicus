import { type NextRequest, NextResponse } from "next/server";
import { GoogleGenAI, Type } from "@google/genai";
import Anthropic from "@anthropic-ai/sdk";
import { withRetry } from "@/lib/retry";

// Fast clarification step. Runs between submit and generation: takes the
// user's rough description, returns 0–3 specific follow-up questions
// whose answers would meaningfully improve the workflow precision.
//
// Sized for speed: gemini-2.5-flash, ~300 max output tokens, single
// turn. The frontend treats failures as "proceed without clarifying" —
// this route never blocks the user from generating.

export const runtime = "nodejs";
export const maxDuration = 15;

const SYSTEM = `You are helping a user map a business workflow precisely. They have described a workflow in rough terms. Your job is to ask 1–3 targeted questions whose answers would meaningfully sharpen the workflow.

YOU MUST GENERATE AT LEAST ONE QUESTION unless the user has named a specific tool for every action they mentioned, defined every condition concretely (timings, thresholds, criteria), and addressed the most likely failure case. Empty array is reserved for descriptions that are already as specific as a runbook.

Treat these as ambiguities that warrant a question (do not silently fill them in for the user):
- Action verbs without a named tool (call, record, summarise, track, review, send, post, log) — ask which tool.
- Trigger phrases like "every week", "every morning", "when X happens" — ask exactly when, or what defines X.
- Vague qualifiers: "qualified", "stalled", "important", "eligible", "high-value" — ask the concrete rule.
- Outputs without a destination: "summarise the signals" / "compile a report" — ask what gets included and where it goes if not stated.
- Exception cases: what happens if the call doesn't connect, the customer doesn't reply, the data is missing.

Each question must reference a specific verb or noun from the user's own text — not generic prompts. Cap at 3.

Examples (input → output):

Input: "I track inbound leads"
Output: ["Where do the leads come from and which CRM are you tracking them in?", "How do you decide which leads to act on — score, source, recency?"]

Input: "When a customer signs up I send them a welcome email"
Output: ["Where does the signup signal come from (Stripe, Auth0, your own DB)?", "Is the welcome email sent from a tool like Customer.io, Mailchimp, or directly via Gmail/SES?"]

Input: "Every Monday I check dashboards, flag issues and brief the team"
Output: ["Which dashboards specifically — and what counts as an issue worth flagging?", "How do you brief the team — Slack message, standup, written doc?"]

Input: "When a refund is requested via Zendesk, I check Stripe for the original charge, refund it through Stripe Dashboard, and reply to the Zendesk ticket with the refund confirmation."
Output: []

Return ONLY a JSON array of question strings. No preamble, no explanation.`;

// Gemini structured output schema. Forces an array of strings so we
// don't have to do regex / markdown stripping on the response.
const responseSchema = {
  type: Type.ARRAY,
  items: { type: Type.STRING },
  // Cap at 3 — the spec is a hard 3-question max regardless of how many
  // useful questions the model might generate.
  maxItems: 3,
};

export async function POST(req: NextRequest) {
  if (!process.env.GEMINI_API_KEY) {
    // No quiet failure — we want to know if env is missing in dev.
    return NextResponse.json(
      { questions: [] as string[], error: "GEMINI_API_KEY missing" },
      { status: 200 }
    );
  }

  let description = "";
  try {
    const body = (await req.json()) as { description?: string };
    description = String(body.description ?? "").trim();
  } catch {
    return NextResponse.json({ questions: [] as string[] }, { status: 200 });
  }
  // Empty / very short descriptions: nothing to clarify against. Returning
  // an empty array means the frontend skips the clarification UI entirely.
  if (description.length < 8) {
    return NextResponse.json({ questions: [] as string[] });
  }

  const gemini = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  // Three-tier fallback mirrors /api/record-to-workflow: Gemini 2.5 →
  // Gemini 2.0 → Claude. Both Gemini models share a daily free-tier
  // quota that's easy to exhaust during testing; Claude runs on a
  // separate API key + quota so it keeps the feature functional even
  // when the Google quota is dry.
  const generateGemini = (model: string) =>
    withRetry(() =>
      gemini.models.generateContent({
        model,
        config: {
          systemInstruction: SYSTEM,
          responseMimeType: "application/json",
          responseSchema,
          maxOutputTokens: 300,
        },
        contents: description,
      })
    );

  // Claude tool-use enforces the same string[] shape as Gemini's
  // responseSchema, so the parsing path downstream stays identical.
  const generateClaude = async (): Promise<string> => {
    if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY missing");
    const anthropic = new Anthropic();
    const result = await withRetry(() =>
      anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 300,
        system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
        tools: [
          {
            name: "submit_questions",
            description: "Submit between 0 and 3 clarifying questions for the workflow description.",
            input_schema: {
              type: "object" as const,
              properties: {
                questions: {
                  type: "array",
                  items: { type: "string" },
                  maxItems: 3,
                },
              },
              required: ["questions"],
            },
          },
        ],
        tool_choice: { type: "tool", name: "submit_questions" },
        messages: [{ role: "user", content: description }],
      })
    );
    const toolUse = result.content.find((b) => b.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") return "[]";
    const input = toolUse.input as { questions?: string[] };
    return JSON.stringify(input.questions ?? []);
  };

  try {
    let text: string | undefined;
    try {
      text = (await generateGemini("gemini-2.5-flash")).text;
    } catch (err) {
      console.warn("[clarify] gemini-2.5-flash failed, falling back to 2.0", err);
      try {
        text = (await generateGemini("gemini-2.0-flash")).text;
      } catch (err2) {
        console.warn("[clarify] gemini-2.0-flash failed, falling back to Claude", err2);
        text = await generateClaude();
      }
    }
    if (!text) return NextResponse.json({ questions: [] as string[] });
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      // Defensive: occasionally a model ignores the responseSchema and
      // wraps the array in surrounding text ("Here is the JSON: [...]").
      // Pull out the first JSON array we can find before giving up.
      const match = text.match(/\[[\s\S]*\]/);
      if (match) {
        try { parsed = JSON.parse(match[0]); } catch { /* fall through */ }
      }
      if (parsed === undefined) {
        console.warn("[clarify] non-JSON response, returning empty:", text.slice(0, 120));
        return NextResponse.json({ questions: [] as string[] });
      }
    }
    if (!Array.isArray(parsed)) {
      return NextResponse.json({ questions: [] as string[] });
    }
    const questions = parsed
      .filter((q): q is string => typeof q === "string" && q.trim().length > 0)
      .slice(0, 3);
    return NextResponse.json({ questions });
  } catch (err) {
    // Hard fall-through: never propagate errors to the user. Skipping
    // clarification gracefully is better than blocking the flow.
    console.warn("[clarify] generation failed", err);
    return NextResponse.json({ questions: [] as string[] });
  }
}
