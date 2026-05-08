import { type NextRequest, NextResponse } from "next/server";
import { GoogleGenAI, Type } from "@google/genai";
import { withRetry } from "@/lib/retry";
import { supabaseServer } from "@/lib/supabase/server";
import {
  createExplainerDraft,
  type EvidenceItem,
  type HowToUseStep,
  type ToolStackItem,
} from "@/lib/explainers";

// Generate an Explainer draft from a narrated screen recording.
//
// Phase 1: transcript-only. The narration text is the sole input —
// no video frames are sent to Gemini yet. Evidence captions come
// back as text without screenshot URLs; the user adds screenshots
// manually on the draft review screen.

export const runtime = "nodejs";
export const maxDuration = 60;

const SYSTEM = `You are generating a structured Explainer artefact from a narrated screen recording transcript. The author has recorded themselves walking through an automation they built.

Extract the following from the narration:

1. hook_headline: A punchy, specific headline that describes the problem this automation solves. Should feel like the opening of a compelling LinkedIn post — warm, human, specific. Use a key phrase in the middle where possible (e.g. "Every new customer gets the same warm welcome — without anyone remembering."). Under 20 words.

2. hook_body: 2-3 sentences expanding on the headline. What does this automation do, when does it run, what does it produce? Plain language, no jargon. Should make a non-technical recipient immediately understand the value.

3. evidence: Identify 3-5 key moments from the narration that show the automation working. For each, return { caption_title, caption_body }. Caption titles are short (e.g. "The trigger", "The welcome email"). Caption bodies are 1-2 sentences explaining what is shown. Focus on moments that prove it's real — not setup steps. Do NOT include screenshot_url; the author adds screenshots in the editor.

4. how_to_use: If the narrator describes how others could use or replicate this automation, extract 2-4 numbered steps. Each step has step_number, title, body. Plain language. If not described, return [].

5. how_i_built_it_headline: A short evocative title for the "how I built it" section. Should feel personal (e.g. "A weekend project that kept paying off."). Under 12 words.

6. how_i_built_it_body: 2-4 paragraphs in the narrator's voice describing how they built it — the problem that pushed them to build it, how they built it, what was hard, any tips. Extract verbatim language from the narration where possible. This must sound like the person, not a product description.

7. trickiest_bit: One sentence describing the trickiest part and how they solved it.

8. tool_stack: Array of { name } for each tool mentioned (e.g. HubSpot, Claude, Gmail, Slack, Notion). No logos — those are added later.

9. automation_platform: The primary platform used (n8n, Zapier, Make, Claude, custom, etc).

10. setup_time: Estimated setup time mentioned or inferred (e.g. "~2 hours").

11. trigger_type: One of "event-based", "scheduled", "manual".

12. why_i_built_it: A single quote in the narrator's voice — the one sentence that captures why they built this. Extract verbatim if possible.

13. is_usable_by_others: true if the narrator describes how others could use or run their own version, false otherwise.

If the transcript is too thin to extract a field meaningfully, leave it null (or an empty array for list fields). Better to leave a field empty than to fabricate.

Return valid JSON only. No preamble, no markdown fences.`;

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    hook_headline: { type: Type.STRING, nullable: true },
    hook_body: { type: Type.STRING, nullable: true },
    evidence: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          caption_title: { type: Type.STRING },
          caption_body: { type: Type.STRING },
        },
        required: ["caption_title", "caption_body"],
      },
    },
    is_usable_by_others: { type: Type.BOOLEAN },
    how_to_use: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          step_number: { type: Type.INTEGER },
          title: { type: Type.STRING },
          body: { type: Type.STRING },
        },
        required: ["step_number", "title", "body"],
      },
    },
    how_i_built_it_headline: { type: Type.STRING, nullable: true },
    how_i_built_it_body: { type: Type.STRING, nullable: true },
    trickiest_bit: { type: Type.STRING, nullable: true },
    tool_stack: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: { name: { type: Type.STRING } },
        required: ["name"],
      },
    },
    automation_platform: { type: Type.STRING, nullable: true },
    setup_time: { type: Type.STRING, nullable: true },
    trigger_type: {
      type: Type.STRING,
      nullable: true,
      enum: ["event-based", "scheduled", "manual"],
    },
    why_i_built_it: { type: Type.STRING, nullable: true },
  },
  required: [
    "hook_headline",
    "hook_body",
    "evidence",
    "is_usable_by_others",
    "how_to_use",
    "how_i_built_it_headline",
    "how_i_built_it_body",
    "tool_stack",
  ],
};

type Generated = {
  hook_headline: string | null;
  hook_body: string | null;
  evidence: EvidenceItem[];
  is_usable_by_others: boolean;
  how_to_use: HowToUseStep[];
  how_i_built_it_headline: string | null;
  how_i_built_it_body: string | null;
  trickiest_bit: string | null;
  tool_stack: ToolStackItem[];
  automation_platform: string | null;
  setup_time: string | null;
  trigger_type: string | null;
  why_i_built_it: string | null;
};

function parseGenerated(raw: string | undefined): Generated | null {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) return null;
    try { parsed = JSON.parse(m[0]); } catch { return null; }
  }
  if (!parsed || typeof parsed !== "object") return null;
  const o = parsed as Record<string, unknown>;
  // Coerce evidence items into the EvidenceItem shape — the LLM emits
  // { caption_title, caption_body } but we store screenshot_url too
  // (null for now since Phase 1 has no keyframe extraction).
  const evidence = Array.isArray(o.evidence)
    ? (o.evidence as Record<string, unknown>[]).map((e) => ({
        screenshot_url: null,
        caption_title: typeof e.caption_title === "string" ? e.caption_title : "",
        caption_body: typeof e.caption_body === "string" ? e.caption_body : "",
      }))
    : [];
  const how_to_use = Array.isArray(o.how_to_use)
    ? (o.how_to_use as Record<string, unknown>[]).map((s, i) => ({
        step_number: typeof s.step_number === "number" ? s.step_number : i + 1,
        title: typeof s.title === "string" ? s.title : "",
        body: typeof s.body === "string" ? s.body : "",
      }))
    : [];
  const tool_stack = Array.isArray(o.tool_stack)
    ? (o.tool_stack as Record<string, unknown>[]).map((t) => ({
        name: typeof t.name === "string" ? t.name : "",
      }))
    : [];
  return {
    hook_headline: (o.hook_headline as string | null) ?? null,
    hook_body: (o.hook_body as string | null) ?? null,
    evidence,
    is_usable_by_others: !!o.is_usable_by_others,
    how_to_use,
    how_i_built_it_headline:
      (o.how_i_built_it_headline as string | null) ?? null,
    how_i_built_it_body: (o.how_i_built_it_body as string | null) ?? null,
    trickiest_bit: (o.trickiest_bit as string | null) ?? null,
    tool_stack,
    automation_platform: (o.automation_platform as string | null) ?? null,
    setup_time: (o.setup_time as string | null) ?? null,
    trigger_type: (o.trigger_type as string | null) ?? null,
    why_i_built_it: (o.why_i_built_it as string | null) ?? null,
  };
}

export async function POST(req: NextRequest) {
  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: "GEMINI_API_KEY missing" }, { status: 500 });
  }

  const supabase = await supabaseServer();
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: { transcript?: string; recording_url?: string | null };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const transcript = (body.transcript ?? "").trim();
  if (transcript.length < 30) {
    return NextResponse.json(
      { error: "Transcript too short to generate an explainer." },
      { status: 400 }
    );
  }

  const gemini = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  let generated: Generated | null = null;
  try {
    const response = await withRetry(() =>
      gemini.models.generateContent({
        model: "gemini-2.5-flash",
        config: {
          systemInstruction: SYSTEM,
          responseMimeType: "application/json",
          responseSchema,
          maxOutputTokens: 4000,
        },
        contents: `Narration transcript:\n\n"""${transcript}"""`,
      })
    );
    generated = parseGenerated(response.text ?? undefined);
  } catch (err) {
    console.error("[explainer/generate] Gemini call failed", err);
    return NextResponse.json(
      { error: "Couldn't generate the explainer. Try recording again." },
      { status: 502 }
    );
  }

  if (!generated || !generated.hook_headline) {
    return NextResponse.json(
      { error: "Model returned an unusable result." },
      { status: 502 }
    );
  }

  try {
    const explainer = await createExplainerDraft(supabase, userData.user.id, {
      hook_headline: generated.hook_headline,
      hook_body: generated.hook_body,
      evidence: generated.evidence,
      is_usable_by_others: generated.is_usable_by_others,
      how_to_use: generated.how_to_use,
      how_i_built_it_headline: generated.how_i_built_it_headline,
      how_i_built_it_body: generated.how_i_built_it_body,
      trickiest_bit: generated.trickiest_bit,
      tool_stack: generated.tool_stack,
      automation_platform: generated.automation_platform,
      setup_time: generated.setup_time,
      trigger_type: generated.trigger_type,
      why_i_built_it: generated.why_i_built_it,
      narration_transcript: transcript,
      recording_url: body.recording_url ?? null,
    });
    return NextResponse.json({ id: explainer.id, token: explainer.token });
  } catch (err) {
    console.error("[explainer/generate] DB insert failed", err);
    return NextResponse.json(
      { error: "Couldn't save the explainer." },
      { status: 500 }
    );
  }
}
