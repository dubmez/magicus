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

  // Pulls a clean string[] out of whatever a model returned. Returns
  // null when the text isn't recoverable (model wrote prose, malformed
  // JSON, etc.), which signals the caller to try the next model.
  const parseQuestions = (text: string | undefined): string[] | null => {
    if (!text) return null;
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      // Models sometimes wrap the JSON in prose ("Here is the JSON: [...]")
      // or quote-escape badly. Try to isolate the first array literal.
      const match = text.match(/\[[\s\S]*\]/);
      if (!match) return null;
      try { parsed = JSON.parse(match[0]); } catch { return null; }
    }
    if (!Array.isArray(parsed)) return null;
    const cleaned = parsed.filter(
      (q): q is string => typeof q === "string" && q.trim().length > 0
    );
    // An empty array is a valid model judgment (description is precise
    // enough). It's only "unparseable" if we got something that wasn't
    // actually a string array at all.
    return cleaned.slice(0, 3);
  };

  const gemini = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  // Three-tier chain. Each attempt swallows its own error / empty /
  // malformed response and returns null — the caller chains them with
  // `??` so we keep trying until one returns usable questions or all
  // three give up. 2.0 is primary because 2.5's JSON-mode adherence
  // has been spotty under load (returning prose preambles or quote-
  // escape glitches that fail JSON.parse).
  const tryGemini = async (model: string): Promise<string[] | null> => {
    try {
      const response = await withRetry(() =>
        gemini.models.generateContent({
          model,
          config: {
            systemInstruction: SYSTEM,
            responseMimeType: "application/json",
            responseSchema,
            maxOutputTokens: 500,
          },
          contents: description,
        })
      );
      const result = parseQuestions(response.text ?? undefined);
      if (result === null) {
        console.warn(`[clarify] ${model} returned unparseable text:`, (response.text ?? "").slice(0, 200));
      }
      return result;
    } catch (err) {
      console.warn(`[clarify] ${model} threw, falling through:`, err);
      return null;
    }
  };

  // Claude tool-use enforces the questions[] shape via its input
  // schema, so we get clean strings back without JSON-mode quirks.
  const tryClaude = async (): Promise<string[] | null> => {
    if (!process.env.ANTHROPIC_API_KEY) return null;
    try {
      const anthropic = new Anthropic();
      const result = await withRetry(() =>
        anthropic.messages.create({
          model: "claude-sonnet-4-6",
          max_tokens: 500,
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
      if (!toolUse || toolUse.type !== "tool_use") return null;
      const input = toolUse.input as { questions?: unknown };
      if (!Array.isArray(input.questions)) return null;
      return input.questions
        .filter((q): q is string => typeof q === "string" && q.trim().length > 0)
        .slice(0, 3);
    } catch (err) {
      console.warn("[clarify] claude threw:", err);
      return null;
    }
  };

  try {
    const questions =
      (await tryGemini("gemini-2.0-flash")) ??
      (await tryGemini("gemini-2.5-flash")) ??
      (await tryClaude()) ??
      [];
    return NextResponse.json({ questions });
  } catch (err) {
    // Hard fall-through: never propagate errors to the user. Skipping
    // clarification gracefully is better than blocking the flow.
    console.warn("[clarify] generation failed", err);
    return NextResponse.json({ questions: [] as string[] });
  }
}
