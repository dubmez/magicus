import { type NextRequest, NextResponse } from "next/server";
import { GoogleGenAI, Type } from "@google/genai";
import { withRetry } from "@/lib/retry";

// Conversational workflow capture. One route serves all three paths
// (explore / quick / deep); the system prompt branches on `path`.
//
// The frontend posts the running history each turn — including the
// user's initial description — and gets back a single Magicus turn
// plus optional metadata (isComplete, recommendationCategory for
// path 1, progressSummary for path 3).

export const runtime = "nodejs";
export const maxDuration = 30;

export type ConversationPath = "explore" | "quick" | "deep";

type Turn = { role: "assistant" | "user"; content: string };

type Body = {
  path: ConversationPath;
  description: string;
  history: Turn[];
};

// Tone rules shared across all three paths. Direct, professional,
// no mirror-paraphrasing of the user's prior input. The original
// versions read warm-but-mushy ("Sounds like you've got a lot on your
// plate!") which slowed the conversation and made the user feel
// re-interviewed rather than helped.
const TONE_RULES = `
Tone:
- Direct and professional. No filler ("Got it", "Awesome", "Thanks for sharing").
- Do NOT paraphrase or mirror the user's previous input back at them. Don't open a turn with "So you do X — got it" before asking your question. Just ask the question.
- One sentence per turn unless a second sentence is genuinely necessary. Keep it tight.
- Plain language. No jargon or hedging.
- Treat the user as a peer who's already given you context — don't restate it.`;

const PATH_1_SYSTEM = `You are an automation advisor helping a user figure out where automation could help them most. You have their initial description.

Ask 2-3 targeted questions to understand: their role and where their time goes, what feels most repetitive, and whether they've tried automating anything before. Ask one question at a time. After 2-3 exchanges, recommend a library template. Don't mention specific tools or platforms yet. Don't ask about technical setup.${TONE_RULES}

Return each response as JSON: { "message": string, "suggestions": string[], "isComplete": boolean, "recommendationCategory": string | null } — suggestions are 2-3 short response options the user can tap, isComplete is true when you have enough to recommend, recommendationCategory is one of: solo_founder, gtm_operator, ops_manager, ecommerce_ops — set it when isComplete is true.`;

const PATH_2_SYSTEM = `You are helping a user map a business workflow quickly. You have their initial description.

Ask up to 3 targeted questions to fill the most important gaps: trigger, who/what tools, and the desired output. Ask only what's genuinely missing — if something's already clear, skip it. Ask one question at a time. After at most 3 exchanges (fewer if you have enough), set isComplete to true.${TONE_RULES}

Return each response as JSON: { "message": string, "suggestions": string[], "isComplete": boolean }`;

const PATH_3_SYSTEM = `You are helping a user build a fully specified automation workflow. Your goal is a spec detailed enough that a developer or automation tool could build it without asking further questions. You have their initial description.

Ask questions one at a time to build the spec. Cover, in a natural order: trigger and conditions, every step in sequence (what / who / which tool), decision points and branches, edge cases and error handling, tools and connectors (specific apps / accounts), ownership of any human-in-the-loop step, desired output and success criteria. Ask follow-ups when answers are ambiguous. Don't move on from a step until it's fully specified. When all areas are covered, set isComplete to true.${TONE_RULES}

Return each response as JSON: { "message": string, "suggestions": string[], "isComplete": boolean, "progressSummary": string } — progressSummary is a one-line summary of what's been captured so far, updated each turn (e.g. 'Trigger and first 3 steps captured — working on edge cases').`;

const PATH_SYSTEM: Record<ConversationPath, string> = {
  explore: PATH_1_SYSTEM,
  quick: PATH_2_SYSTEM,
  deep: PATH_3_SYSTEM,
};

// Single shared schema — the optional fields are honoured when the
// model emits them, ignored otherwise. Keeping one schema means we
// don't have to switch the schema based on path; the systemInstruction
// already tells the model whether to set recommendationCategory /
// progressSummary.
const responseSchema = {
  type: Type.OBJECT,
  properties: {
    message: { type: Type.STRING },
    suggestions: { type: Type.ARRAY, items: { type: Type.STRING } },
    isComplete: { type: Type.BOOLEAN },
    recommendationCategory: { type: Type.STRING, nullable: true },
    progressSummary: { type: Type.STRING, nullable: true },
  },
  required: ["message", "suggestions", "isComplete"],
};

const VALID_CATEGORIES = new Set([
  "solo_founder",
  "gtm_operator",
  "ops_manager",
  "ecommerce_ops",
]);

type Reply = {
  message: string;
  suggestions: string[];
  isComplete: boolean;
  recommendationCategory: string | null;
  progressSummary: string | null;
};

// Render the running conversation as a flat user-prompt body. The
// model sees the original description first, then each prior turn
// labelled, then is asked to produce only the next assistant turn.
// We avoid Gemini's `contents:[{role,parts}]` array form because the
// JSON-mode + multi-turn combo has been less reliable than passing
// the whole transcript as a single user message.
function buildContents(description: string, history: Turn[]): string {
  const lines = [
    `User's initial description:\n${description}`,
    "",
    "Conversation so far:",
  ];
  if (history.length === 0) {
    lines.push("(no exchanges yet — produce the first assistant turn)");
  } else {
    for (const t of history) {
      const tag = t.role === "assistant" ? "Assistant" : "User";
      lines.push(`${tag}: ${t.content}`);
    }
  }
  lines.push("");
  lines.push("Produce the next assistant turn as JSON.");
  return lines.join("\n");
}

function parseReply(text: string | undefined, path: ConversationPath): Reply | null {
  if (!text) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try { parsed = JSON.parse(match[0]); } catch { return null; }
  }
  if (!parsed || typeof parsed !== "object") return null;
  const obj = parsed as Record<string, unknown>;
  const message = typeof obj.message === "string" ? obj.message.trim() : "";
  if (!message) return null;
  const suggestions = Array.isArray(obj.suggestions)
    ? obj.suggestions
        .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
        .slice(0, 4)
    : [];
  const isComplete = obj.isComplete === true;
  let recommendationCategory: string | null = null;
  if (path === "explore") {
    const c = typeof obj.recommendationCategory === "string" ? obj.recommendationCategory : null;
    if (c && VALID_CATEGORIES.has(c)) recommendationCategory = c;
  }
  const progressSummary =
    path === "deep" && typeof obj.progressSummary === "string" && obj.progressSummary.trim().length > 0
      ? obj.progressSummary.trim()
      : null;
  return { message, suggestions, isComplete, recommendationCategory, progressSummary };
}

export async function POST(req: NextRequest) {
  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: "GEMINI_API_KEY missing" }, { status: 500 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { path, description, history } = body;
  if (!path || !PATH_SYSTEM[path]) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }
  if (!description || description.trim().length < 1) {
    return NextResponse.json({ error: "Description required" }, { status: 400 });
  }
  const safeHistory: Turn[] = Array.isArray(history)
    ? history
        .filter(
          (t): t is Turn =>
            !!t &&
            typeof t === "object" &&
            (t.role === "assistant" || t.role === "user") &&
            typeof t.content === "string"
        )
        .slice(-30)
    : [];

  const contents = buildContents(description, safeHistory);
  const gemini = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  const tryGemini = async (model: string): Promise<Reply | null> => {
    try {
      const response = await withRetry(() =>
        gemini.models.generateContent({
          model,
          config: {
            systemInstruction: PATH_SYSTEM[path],
            responseMimeType: "application/json",
            responseSchema,
            maxOutputTokens: 800,
          },
          contents,
        })
      );
      const result = parseReply(response.text ?? undefined, path);
      if (result === null) {
        console.warn(`[conversation] ${model} returned unparseable text:`, (response.text ?? "").slice(0, 200));
      }
      return result;
    } catch (err) {
      console.warn(`[conversation] ${model} threw:`, err);
      return null;
    }
  };

  try {
    const reply =
      (await tryGemini("gemini-2.5-flash")) ??
      (await tryGemini("gemini-2.0-flash"));
    if (!reply) {
      return NextResponse.json(
        { error: "Couldn't generate response" },
        { status: 502 }
      );
    }
    return NextResponse.json(reply);
  } catch (err) {
    console.error("[conversation] failed", err);
    return NextResponse.json({ error: "Generation failed" }, { status: 500 });
  }
}
