import { type NextRequest, NextResponse } from "next/server";
import { GoogleGenAI, createPartFromUri, createUserContent, Type } from "@google/genai";
import { del } from "@vercel/blob";

// Vercel function config: Gemini calls for video can run 15-30s+, so bump the
// max duration. (Hobby tier ceiling is 60s; we ask for 60.)
export const maxDuration = 60;

// Force Node.js runtime — we read FormData with a binary file in it; Edge
// runtime has different streaming semantics and lower body limits.
export const runtime = "nodejs";

type GeneratedAutomationPotential = "high" | "medium" | "low";

type GeneratedStep = {
  n: number;
  text: string;
  note?: string;
  owner?: string;
  timestamp?: number; // seconds into the recording
  automationPotential?: GeneratedAutomationPotential;
  isSensitive?: boolean;
};

type GeneratedWorkflow = {
  id: string;
  theme: "sales" | "marketing" | "operations" | "finance";
  name: string;
  trigger:
    | { type: "schedule" | "event" | "manual" | "chained"; description?: string }
    | null;
  why: string;
  inputs: { name: string; source: string }[];
  steps: GeneratedStep[];
  outputs: { name: string; source: string }[];
  tools: string[];
  automationScore: number;
  automationRationale: string;
};

// Response schema — Gemini honours this and returns valid JSON we can parse
// without regex'ing markdown fences out of the text.
const responseSchema = {
  type: Type.OBJECT,
  properties: {
    name: { type: Type.STRING },
    theme: {
      type: Type.STRING,
      enum: ["sales", "marketing", "operations", "finance"],
    },
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
    steps: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          n: { type: Type.INTEGER },
          text: { type: Type.STRING },
          note: { type: Type.STRING, nullable: true },
          owner: { type: Type.STRING, nullable: true },
          timestamp: { type: Type.NUMBER, nullable: true },
          automationPotential: {
            type: Type.STRING,
            enum: ["high", "medium", "low"],
          },
          isSensitive: { type: Type.BOOLEAN, nullable: true },
        },
        required: ["n", "text", "automationPotential"],
      },
    },
    tools: { type: Type.ARRAY, items: { type: Type.STRING } },
    automationScore: { type: Type.INTEGER },
    automationRationale: { type: Type.STRING },
  },
  required: [
    "name", "theme", "trigger", "why", "inputs", "outputs",
    "steps", "tools", "automationScore", "automationRationale",
  ],
};

const SYSTEM_PROMPT = `You are watching a screen recording of a business workflow. The user narrated as they worked. Extract a structured workflow object.

CRITICAL RULES
- Use only what you observe in the video and hear in the narration. Treat both as equal, complementary signals — neither outranks the other. The video shows what the user actually clicked, opened, and typed; the narration explains the why and the implicit branches. Cross-check between them: if narration mentions a tool the video confirms, lock that detail in. If narration alone implies a step that the video doesn't show, prefer the narration. If only the video shows it, prefer the video. Do not invent steps, tools, or details not present in either source.
- Leave fields empty (empty strings, empty arrays, null) rather than guessing. It's better to miss a detail than to fabricate one.
- Step text must be action-first and concise. Examples: "Click 'New post'", "Fill in the subject line", "Check eligibility in Stripe", "Open the Calendly dashboard".
- For each step, set "timestamp" to the second in the video where that step is most clearly happening — we use this to pull a representative frame.
- "tools" must be apps you actually saw or heard the user use, not your guesses about what they might use.
- "theme" is the workflow's domain: sales, marketing, operations, or finance. Pick the closest fit.
- "automationScore" (0-100) reflects how much of THIS workflow could be automated. Steps requiring human judgement or live conversation lower the score; rule-based or templated steps raise it.
- "trigger" describes what kicks the workflow off. If the recording starts with the user explicitly opening something on a schedule or in response to an event, capture that. Otherwise leave it as { "type": "manual" }.
- "why" is one or two sentences on the purpose of the workflow, drawn from narration if available — not a guess.

For each step, classify on TWO independent properties:
- "automationPotential" — how automatable the mechanics of the step are, on its own:
  - "high" — rule-based and deterministic (parsing, scheduling, logging, sending templated messages, calling an API with structured inputs)
  - "medium" — automatable but benefits from human oversight (drafting from a template, scoring against rules, summarising for review)
  - "low" — requires human judgement, taste, creativity, or live relationship context (qualifying ambiguous fit, writing personalised outreach, prioritising exceptions)
- "isSensitive" — true if the step handles payment data, personal/identity data, legal commitments, access/permission changes, or consequential irreversible actions (sending invoices or contracts, moving money, granting access, modifying production). Otherwise omit it.

These are ORTHOGONAL — a step that is easy to automate can still be sensitive (e.g. generating a Stripe invoice from a templated input is rule-based but moves money). Classify each property independently. Be honest. If unsure between high and medium, prefer medium.

Return ONLY the JSON object. No prose around it.`;

// Wait until the uploaded file's state is ACTIVE — Gemini does some
// processing on video uploads before they're queryable.
async function waitForFileActive(
  client: GoogleGenAI,
  fileName: string,
  timeoutMs = 50_000
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const f = await client.files.get({ name: fileName });
    if (f.state === "ACTIVE") return;
    if (f.state === "FAILED") throw new Error("File processing failed");
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new Error("File processing timed out");
}

type ApiErrorLike = { status?: number; message?: string };

function isOverloaded(err: unknown): boolean {
  const e = err as ApiErrorLike;
  return (
    e.status === 503 ||
    (typeof e.message === "string" &&
      (e.message.includes("UNAVAILABLE") || e.message.includes("503")))
  );
}

// Gemini 2.5 Flash returns 503 UNAVAILABLE when the model is overloaded.
// One automatic retry with a 1.2s backoff catches the common case where the
// spike clears in seconds.
async function callWithRetry<T>(call: () => Promise<T>, label: string): Promise<T> {
  try {
    return await call();
  } catch (err) {
    if (!isOverloaded(err)) throw err;
    console.warn(`[record-to-workflow] ${label}: 503 — retrying once after 1.2s`);
    await new Promise((r) => setTimeout(r, 1200));
    return await call();
  }
}

// Tries 2.5 Flash (with retry), then falls back to 2.0 Flash (with retry)
// when 2.5 keeps overloading. 2.0 Flash supports the same multimodal inputs
// and responseSchema; it lacks 2.5's thinking tokens so output may be
// slightly less precise, which is a fine trade for not failing the user.
async function generateWithFallback(
  client: GoogleGenAI,
  contents: ReturnType<typeof createUserContent>
) {
  const config = {
    responseMimeType: "application/json",
    responseSchema,
    maxOutputTokens: 8000,
  };
  try {
    return await callWithRetry(
      () =>
        client.models.generateContent({ model: "gemini-2.5-flash", contents, config }),
      "gemini-2.5-flash"
    );
  } catch (err) {
    if (!isOverloaded(err)) throw err;
    console.warn(
      "[record-to-workflow] gemini-2.5-flash overloaded after retry — falling back to gemini-2.0-flash"
    );
    return await callWithRetry(
      () =>
        client.models.generateContent({ model: "gemini-2.0-flash", contents, config }),
      "gemini-2.0-flash"
    );
  }
}

export async function POST(req: NextRequest) {
  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json(
      { error: "Server is missing GEMINI_API_KEY." },
      { status: 500 }
    );
  }

  // The recording is uploaded to Vercel Blob client-side (Browser → Blob
  // direct), then we get a JSON pointer here. This bypasses Vercel's 4.5MB
  // function payload cap, which a 30s+ webm easily exceeds.
  let blobUrl = "";
  let transcript = "";
  let durationSeconds = 0;
  let mimeType = "video/webm";

  try {
    const body = (await req.json()) as {
      blobUrl?: string;
      transcript?: string;
      durationSeconds?: number;
      mimeType?: string;
    };
    blobUrl = String(body.blobUrl ?? "").trim();
    transcript = String(body.transcript ?? "").trim();
    durationSeconds = Number(body.durationSeconds ?? 0);
    mimeType = String(body.mimeType ?? "video/webm");
  } catch (err) {
    console.error("[record-to-workflow] failed to parse JSON", err);
    return NextResponse.json(
      { error: "Could not read the upload." },
      { status: 400 }
    );
  }

  if (!blobUrl) {
    return NextResponse.json(
      { error: "No recording attached." },
      { status: 400 }
    );
  }
  // Defensive — only allow URLs from our own Blob bucket so an attacker can't
  // point us at an arbitrary host and use this route as a fetch proxy.
  if (!/^https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\//.test(blobUrl)) {
    return NextResponse.json(
      { error: "Invalid recording location." },
      { status: 400 }
    );
  }
  if (durationSeconds < 15) {
    return NextResponse.json(
      { error: "Recording too short — please record at least 15 seconds." },
      { status: 400 }
    );
  }

  const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  // Always try to clean up the Blob after we're done — success or failure.
  // Recordings are throwaway; we only need them long enough to forward to
  // Gemini's File API. Wrapped so a delete failure can't mask the real
  // error from the user.
  const cleanupBlob = async () => {
    try {
      await del(blobUrl);
    } catch (err) {
      console.warn("[record-to-workflow] blob cleanup failed", err);
    }
  };

  try {
    // Pull the recording from Blob and stream it into Gemini's File API.
    // (Gemini's SDK accepts a Blob/File-like for upload.)
    const blobRes = await fetch(blobUrl);
    if (!blobRes.ok) {
      throw new Error(`Blob fetch failed: ${blobRes.status}`);
    }
    const videoBlob = await blobRes.blob();
    const uploaded = await client.files.upload({
      file: videoBlob,
      config: { mimeType },
    });
    if (!uploaded.name) {
      throw new Error("Upload did not return a file name");
    }
    await waitForFileActive(client, uploaded.name);

    // Build the user prompt. The transcript goes alongside the video so the
    // model has both modalities to work from.
    const userPromptParts: Array<{ text: string } | ReturnType<typeof createPartFromUri>> = [];
    if (uploaded.uri && uploaded.mimeType) {
      userPromptParts.push(createPartFromUri(uploaded.uri, uploaded.mimeType));
    }
    userPromptParts.push({
      text:
        SYSTEM_PROMPT +
        "\n\n" +
        (transcript
          ? `User narration transcript:\n"""\n${transcript}\n"""`
          : "(No narration was captured. Work from the video alone, and leave 'why' empty if you cannot tell why this workflow exists.)"),
    });

    const response = await generateWithFallback(
      client,
      createUserContent(userPromptParts)
    );

    const text = response.text;
    if (!text) throw new Error("Empty response from model");

    let parsed: GeneratedWorkflow;
    try {
      parsed = JSON.parse(text) as GeneratedWorkflow;
    } catch (err) {
      console.error("[record-to-workflow] JSON parse failed", err, text.slice(0, 500));
      return NextResponse.json(
        { error: "Model response could not be parsed." },
        { status: 502 }
      );
    }

    // Sanity check the parsed shape — if Gemini returns something off-schema
    // we surface the user-facing error rather than crash on the canvas.
    if (
      !parsed.name ||
      !Array.isArray(parsed.steps) ||
      parsed.steps.length === 0
    ) {
      return NextResponse.json(
        { error: "Model returned an incomplete workflow." },
        { status: 502 }
      );
    }

    // Renumber steps defensively in case the model misnumbered them.
    parsed.steps = parsed.steps.map((s, i) => ({ ...s, n: i + 1 }));

    // Add the id last so the client can use it as-is.
    const workflow = { ...parsed, id: "rec" };

    await cleanupBlob();
    return NextResponse.json({ workflow });
  } catch (err) {
    console.error("[record-to-workflow] gemini error", err);
    await cleanupBlob();
    const e = err as ApiErrorLike;
    const msg = typeof e.message === "string" ? e.message : "";
    if (
      e.status === 503 ||
      msg.includes("UNAVAILABLE") ||
      msg.includes("503")
    ) {
      return NextResponse.json(
        {
          error:
            "Gemini is overloaded right now — please try again in a minute.",
        },
        { status: 503 }
      );
    }
    if (msg.includes("File processing failed")) {
      return NextResponse.json(
        {
          error:
            "Gemini couldn't process the recording. Make sure it's a valid screen recording and try again.",
        },
        { status: 502 }
      );
    }
    if (msg.includes("File processing timed out")) {
      return NextResponse.json(
        { error: "Recording took too long to process — please try again." },
        { status: 504 }
      );
    }
    return NextResponse.json(
      { error: "Failed to process recording." },
      { status: 500 }
    );
  }
}
