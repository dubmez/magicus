import { type NextRequest, NextResponse } from "next/server";
import { GoogleGenAI, Type } from "@google/genai";
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

  const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  // Same model fallback chain as /api/record-to-workflow: 2.5 first
  // (smarter, but currently flaky), 2.0 as the bench. Either model
  // returns the same JSON shape so the caller doesn't care which ran.
  const generate = (model: string) =>
    withRetry(() =>
      client.models.generateContent({
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

  try {
    let response;
    try {
      response = await generate("gemini-2.5-flash");
    } catch (err) {
      // 503 / capacity issues on 2.5 right now are common enough that
      // routinely failing the clarify step would defeat the feature.
      // 2.0 Flash supports the same responseSchema and runs in parallel
      // capacity, so a failover keeps us functional.
      console.warn("[clarify] gemini-2.5-flash failed, falling back to 2.0", err);
      response = await generate("gemini-2.0-flash");
    }

    const text = response.text;
    // Optional debug echo — only when ?debug=1 in the request URL.
    // Lets us see the raw model output without enabling verbose logging
    // for every clarify call. Remove once the calibration is settled.
    const debug = new URL(req.url).searchParams.get("debug") === "1";
    if (debug) {
      console.info("[clarify] raw response", text);
    }
    if (!text) return NextResponse.json({ questions: [] as string[], ...(debug ? { _raw: null } : {}) });
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return NextResponse.json({ questions: [] as string[] });
    }
    if (!Array.isArray(parsed)) {
      return NextResponse.json({
        questions: [] as string[],
        ...(debug ? { _raw: text, _parsed: parsed } : {}),
      });
    }
    const questions = parsed
      .filter((q): q is string => typeof q === "string" && q.trim().length > 0)
      .slice(0, 3);
    return NextResponse.json({
      questions,
      ...(debug ? { _raw: text } : {}),
    });
  } catch (err) {
    // Hard fall-through: never propagate errors to the user. Skipping
    // clarification gracefully is better than blocking the flow.
    console.warn("[clarify] generation failed", err);
    return NextResponse.json({ questions: [] as string[] });
  }
}
