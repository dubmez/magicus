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

const SYSTEM = `You are helping a user map a business workflow precisely. They have described a workflow in rough terms. Your job is to identify the most important missing information that would make this workflow more precise and more useful as an automation blueprint.

DEFAULT TO ASKING. Most rough descriptions have at least one workflow-shaping ambiguity worth clarifying — return between 1 and 3 questions in almost every case. Only return an empty array if the description is exceptionally complete: specific tools named for every action, explicit trigger condition (with timing if scheduled), named decision criteria, and clear handling of the most likely exception.

SPECIFIC GAPS TO CHECK FOR (ask if not stated):
- Trigger timing: "every week" → which day and time? "when X happens" → what concretely defines X (a cart abandoned >Y minutes? value over $Z?)
- Specific tools: the user mentions an action like "call", "record", "summarise", "track" but no tool — ask which one (Aircall? OpenPhone? Fireflies? a spreadsheet?). Don't assume.
- Decision criteria: "if the customer wants X" / "qualified leads" / "stalled" → how is that judged in practice?
- Vague verbs: "summarise the signals" / "review" / "process" / "analyse" — what is the concrete output and what specifically is being summarised?
- Common exceptions: what happens if the call doesn't connect, the email bounces, no records match, the API rate-limits?

Do not ask generic questions like "Can you tell me more?" or "What tools do you use?" — make every question pointed at a specific gap in this user's description, naming the verb or noun from their text.

Prioritise the most workflow-shaping ambiguity first. Ask at most 3 questions; fewer is better than padding.

Return ONLY a JSON array of question strings. No preamble, no explanation. Example: ["Who decides whether a lead is qualified — is there a scoring threshold?", "What happens if the customer doesn't answer the call?"]`;

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

  try {
    const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const response = await withRetry(() =>
      client.models.generateContent({
        model: "gemini-2.5-flash",
        config: {
          systemInstruction: SYSTEM,
          responseMimeType: "application/json",
          responseSchema,
          maxOutputTokens: 300,
        },
        contents: description,
      })
    );

    const text = response.text;
    if (!text) return NextResponse.json({ questions: [] as string[] });
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return NextResponse.json({ questions: [] as string[] });
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
