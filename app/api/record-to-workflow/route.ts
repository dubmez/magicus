import { type NextRequest, NextResponse } from "next/server";

// Phase A stub: returns a plausible mock workflow so the UI flow can be
// exercised end-to-end without a Gemini key. Phase B will replace the body
// of this handler with a real Gemini 2.5 Flash File API call.
//
// Request: { transcript: string, durationSeconds: number, mimeType: string }
//   (the actual video blob is not yet uploaded — Phase B will use multipart
//    or a Vercel Blob handoff so we don't bloat the function body)
// Response: { workflow: GeneratedWorkflow } | { error: string }

type GeneratedStep = {
  n: number;
  text: string;
  note?: string;
  owner?: string;
  // Optional timestamp (seconds into the video) — Phase B has Gemini return
  // these so the client can extract a screenshot per step.
  timestamp?: number;
};

type GeneratedWorkflow = {
  id: string;
  theme: "sales" | "marketing" | "operations" | "finance";
  name: string;
  trigger: { type: "schedule" | "event" | "manual" | "chained"; description?: string } | null;
  why: string;
  inputs: { name: string; source: string }[];
  steps: GeneratedStep[];
  outputs: { name: string; source: string }[];
  tools: string[];
  automationScore: number;
  automationRationale: string;
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      transcript?: string;
      durationSeconds?: number;
      mimeType?: string;
    };

    const transcript = (body.transcript ?? "").trim();
    const duration = Number(body.durationSeconds ?? 0);

    // Reject very short clips per spec — Gemini will struggle and the user
    // gets a better experience seeing the explicit error than a vague output.
    if (duration < 15) {
      return NextResponse.json(
        { error: "Recording too short — please record at least 15 seconds." },
        { status: 400 }
      );
    }

    // Simulate a realistic processing delay so the Processing screen has
    // something to do. Real Gemini calls typically take 5–15 seconds for
    // ~2-minute recordings.
    await new Promise((resolve) => setTimeout(resolve, 4000));

    // Build a mock workflow that loosely reflects what the user said. We
    // pick out a few words from the transcript so it doesn't look like
    // a constant fixture.
    const excerpt = transcript.slice(0, 60).trim();
    const name = excerpt
      ? `Workflow from recording${excerpt.length > 0 ? "" : ""}`
      : "Workflow from recording";

    const workflow: GeneratedWorkflow = {
      id: "rec",
      theme: "operations",
      name,
      trigger: { type: "manual", description: "Triggered from a screen recording" },
      why: transcript.slice(0, 200) || "Captured from a screen recording. Edit me to add why this matters.",
      inputs: [
        { name: "Recording transcript", source: "Magicus" },
      ],
      steps: [
        { n: 1, text: "Open the tool you were recording", timestamp: 2 },
        { n: 2, text: "Perform the actions you narrated", timestamp: Math.max(8, duration / 3) },
        { n: 3, text: "Confirm the result and close out", timestamp: Math.max(15, (duration * 2) / 3) },
      ],
      outputs: [
        { name: "Outcome of the recorded process", source: "Your tool" },
      ],
      tools: [],
      automationScore: 55,
      automationRationale:
        "Stubbed score — Phase B will use Gemini to score automation potential from the recording.",
    };

    return NextResponse.json({ workflow });
  } catch (err) {
    console.error("[record-to-workflow] error", err);
    return NextResponse.json(
      { error: "Failed to process recording." },
      { status: 500 }
    );
  }
}
