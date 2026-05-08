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

const PATH_1_SYSTEM = `You are a friendly, knowledgeable automation advisor helping a non-technical user figure out where AI automation could help them most. You have their initial description of their work or goal. Your job is to ask 2-3 short, friendly questions to understand: their role and what they spend most of their time on, what feels most repetitive or tedious, and whether they've tried automating anything before. Keep questions conversational and warm — never technical. Ask one question at a time. After 2-3 exchanges, you will recommend a library template. Do not mention specific tools or platforms yet. Do not ask about technical setup. Return each response as JSON: { "message": string, "suggestions": string[], "isComplete": boolean, "recommendationCategory": string | null } — suggestions are 2-3 short response options the user can tap, isComplete is true when you have enough to recommend, recommendationCategory is one of: solo_founder, gtm_operator, ops_manager, ecommerce_ops — set it when isComplete is true.`;

const PATH_2_SYSTEM = `You are helping a user map a business workflow quickly. You have their initial description. Ask up to 3 targeted questions to fill in the most important gaps: what triggers this workflow, who is involved and which tools are used, and what the desired output or outcome is. Ask only what's genuinely missing from their description — if something is already clear, don't ask about it. Ask one question at a time. Keep questions short and direct. After at most 3 exchanges (or fewer if you have enough), set isComplete to true. Return each response as JSON: { "message": string, "suggestions": string[], "isComplete": boolean }`;

const PATH_3_SYSTEM = `You are helping a user build a fully specified automation workflow. Your goal is to produce a workflow detailed enough that a developer or automation tool could build it without asking any further questions. You have their initial description. Ask questions one at a time to progressively build the specification. Cover all of the following — in a natural conversational order, not as a checklist: the trigger (what exactly starts this workflow, under what conditions), every step in sequence (what happens, who or what does it, which specific tool), decision points and branches (what are the conditions, what happens in each case), edge cases and error handling (what if something fails, what if data is missing, what if the user doesn't respond), the tools and connectors involved (which specific apps, which accounts or instances), ownership (who is responsible for each step that requires a human), the desired output and how success is measured. Ask follow-up questions when answers are ambiguous. Do not move on from a step until it is fully specified. When every area above has been covered and the workflow is unambiguous, set isComplete to true. Return each response as JSON: { "message": string, "suggestions": string[], "isComplete": boolean, "progressSummary": string } — progressSummary is a one-line summary of what has been captured so far, updated each turn (e.g. 'Trigger and first 3 steps captured — working on edge cases').`;

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
