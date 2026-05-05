import { type NextRequest, NextResponse } from "next/server";
import { GoogleGenAI, createPartFromUri, createUserContent, Type } from "@google/genai";
import { del, get } from "@vercel/blob";
import Anthropic from "@anthropic-ai/sdk";

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

// 429 RESOURCE_EXHAUSTED — Gemini's free-tier daily/minute quotas. When this
// trips we route the request to Claude instead. Same project means 2.5 and
// 2.0 typically share quota state, so retrying within Gemini is pointless.
function isQuotaExhausted(err: unknown): boolean {
  const e = err as ApiErrorLike;
  return (
    e.status === 429 ||
    (typeof e.message === "string" &&
      (e.message.includes("RESOURCE_EXHAUSTED") ||
        e.message.includes("429") ||
        e.message.includes("exceeded your current quota")))
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

// ─── Claude fallback ──────────────────────────────────────────────────────
//
// Used when Gemini's free tier 429s. Claude can't watch video, so the
// client extracts ~10 evenly-spaced frames and ships them alongside the
// transcript. Lower fidelity than Gemini's continuous video read, but the
// narration carries most of the semantic load anyway.

const anthropicTool = {
  name: "generate_workflow",
  description: "Output the structured workflow extracted from the screen recording frames.",
  input_schema: {
    type: "object" as const,
    properties: {
      name: { type: "string" },
      theme: { type: "string", enum: ["sales", "marketing", "operations", "finance"] },
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
            n: { type: "integer" },
            text: { type: "string" },
            note: { type: "string" },
            owner: { type: "string" },
            timestamp: { type: "number" },
            automationPotential: { type: "string", enum: ["high", "medium", "low"] },
            isSensitive: { type: "boolean" },
          },
          required: ["n", "text", "automationPotential"],
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
      automationScore: { type: "integer", minimum: 0, maximum: 100 },
      automationRationale: { type: "string" },
    },
    required: [
      "name", "theme", "trigger", "why", "inputs", "outputs",
      "steps", "tools", "automationScore", "automationRationale",
    ],
  },
};

type FallbackFrame = { timestamp: number; dataUrl: string };

async function generateWithClaude(
  frames: FallbackFrame[],
  transcript: string
): Promise<GeneratedWorkflow> {
  if (frames.length === 0) {
    throw new Error("No fallback frames available for Claude path");
  }
  const client = new Anthropic();

  type ImageMedia = "image/jpeg" | "image/png" | "image/webp" | "image/gif";
  const imageBlocks = frames.map((f) => {
    const m = /^data:image\/(jpeg|png|webp|gif);base64,(.+)$/.exec(f.dataUrl);
    if (!m) throw new Error("Invalid frame data URL");
    return {
      type: "image" as const,
      source: {
        type: "base64" as const,
        media_type: `image/${m[1]}` as ImageMedia,
        data: m[2],
      },
    };
  });

  const timestampList = frames
    .map((f) => f.timestamp.toFixed(1))
    .join(", ");

  const userContent: Anthropic.Messages.ContentBlockParam[] = [
    {
      type: "text",
      text:
        `Here are ${frames.length} frames captured at evenly-spaced timestamps from a screen recording of a business workflow. The user narrated as they worked.\n\n` +
        `Frame timestamps in seconds (in order shown): ${timestampList}.\n\n` +
        `When you set "timestamp" on a step, pick the timestamp of the frame that best shows that step happening.`,
    },
    ...imageBlocks,
    {
      type: "text",
      text: transcript
        ? `User narration transcript:\n"""\n${transcript}\n"""`
        : "(No narration was captured. Work from the frames alone, and leave 'why' empty if you cannot tell why this workflow exists.)",
    },
  ];

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4000,
    system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
    tools: [anthropicTool],
    tool_choice: { type: "tool", name: "generate_workflow" },
    messages: [{ role: "user", content: userContent }],
  });

  const toolUse = response.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("Claude did not return a tool_use response");
  }
  return toolUse.input as GeneratedWorkflow;
}

export async function POST(req: NextRequest) {
  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json(
      { error: "Server is missing GEMINI_API_KEY." },
      { status: 500 }
    );
  }

  // The recording is uploaded as ~3.5MB chunks to /api/record-chunk and
  // then handed to us as a list of blob URLs. We pull each chunk from Blob,
  // concatenate, and forward to Gemini. The client also extracts ~10
  // evenly-spaced frames in case Gemini hits its quota and we need to
  // re-attempt via Claude (which can't accept video natively).
  let blobUrls: string[] = [];
  let transcript = "";
  let durationSeconds = 0;
  let mimeType = "video/webm";
  let fallbackFrames: FallbackFrame[] = [];

  try {
    const body = (await req.json()) as {
      blobUrls?: string[];
      transcript?: string;
      durationSeconds?: number;
      mimeType?: string;
      fallbackFrames?: FallbackFrame[];
    };
    blobUrls = Array.isArray(body.blobUrls) ? body.blobUrls : [];
    transcript = String(body.transcript ?? "").trim();
    durationSeconds = Number(body.durationSeconds ?? 0);
    mimeType = String(body.mimeType ?? "video/webm");
    fallbackFrames = Array.isArray(body.fallbackFrames)
      ? body.fallbackFrames.filter(
          (f): f is FallbackFrame =>
            !!f &&
            typeof f.timestamp === "number" &&
            typeof f.dataUrl === "string" &&
            f.dataUrl.startsWith("data:image/")
        )
      : [];
  } catch (err) {
    console.error("[record-to-workflow] failed to parse JSON", err);
    return NextResponse.json(
      { error: "Could not read the upload." },
      { status: 400 }
    );
  }

  if (blobUrls.length === 0) {
    return NextResponse.json(
      { error: "No recording attached." },
      { status: 400 }
    );
  }
  // Defensive — only allow URLs from Vercel Blob so an attacker can't point
  // us at an arbitrary host and use this route as a fetch proxy. Private
  // and public blobs sit on different subdomains, so we match either.
  const blobPattern = /^https:\/\/[a-z0-9-]+\.(?:public|private)\.blob\.vercel-storage\.com\//;
  if (!blobUrls.every((u) => typeof u === "string" && blobPattern.test(u))) {
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

  // Always try to clean up the Blobs after we're done — success or failure.
  // Recordings are throwaway; we only need them long enough to forward to
  // Gemini's File API. Wrapped so a delete failure can't mask the real
  // error from the user.
  const cleanupBlob = async () => {
    try {
      await del(blobUrls);
    } catch (err) {
      console.warn("[record-to-workflow] blob cleanup failed", err);
    }
  };

  try {
    // Pull each chunk from Blob in order and stitch them back into a single
    // recording. webm/mp4 are append-friendly when the chunks come from the
    // same MediaRecorder session, so binary concatenation reproduces the
    // original file byte-for-byte. Chunks are stored as private blobs, so
    // we use the SDK's `get()` which authenticates with our R/W token.
    const buffers = await Promise.all(
      blobUrls.map(async (url) => {
        const downloaded = await get(url, { access: "private" });
        if (!downloaded || downloaded.statusCode !== 200 || !downloaded.stream) {
          throw new Error(`Blob fetch failed: status ${downloaded?.statusCode ?? "unknown"}`);
        }
        return new Uint8Array(await new Response(downloaded.stream).arrayBuffer());
      })
    );
    const totalBytes = buffers.reduce((n, b) => n + b.byteLength, 0);
    const merged = new Uint8Array(totalBytes);
    let offset = 0;
    for (const b of buffers) {
      merged.set(b, offset);
      offset += b.byteLength;
    }
    const videoBlob = new Blob([merged], { type: mimeType });
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

    let parsed: GeneratedWorkflow;
    try {
      const response = await generateWithFallback(
        client,
        createUserContent(userPromptParts)
      );
      const text = response.text;
      if (!text) throw new Error("Empty response from model");
      try {
        parsed = JSON.parse(text) as GeneratedWorkflow;
      } catch (err) {
        console.error("[record-to-workflow] JSON parse failed", err, text.slice(0, 500));
        await cleanupBlob();
        return NextResponse.json(
          { error: "Model response could not be parsed." },
          { status: 502 }
        );
      }
    } catch (err) {
      // Gemini quota exhausted? Try Claude with the client-supplied frames.
      // Other Gemini failures (overload, file processing, parse errors)
      // bubble up to the outer catch.
      if (
        isQuotaExhausted(err) &&
        fallbackFrames.length > 0 &&
        process.env.ANTHROPIC_API_KEY
      ) {
        console.warn(
          "[record-to-workflow] Gemini quota exhausted — falling back to Claude"
        );
        parsed = await generateWithClaude(fallbackFrames, transcript);
      } else {
        throw err;
      }
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
    // Quota exhausted with no fallback configured/available — surface a
    // user-friendly message rather than the generic 500.
    if (isQuotaExhausted(err)) {
      return NextResponse.json(
        {
          error:
            "Both Gemini and our Claude fallback couldn't process the recording right now — please try again shortly or describe your workflow in text instead.",
        },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { error: "Failed to process recording." },
      { status: 500 }
    );
  }
}
