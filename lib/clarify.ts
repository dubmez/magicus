// Client-side helpers for the clarification step that runs between user
// submit and workflow generation. The /api/clarify route handles the
// LLM call; this module just shapes requests and responses for the UI.

export type ClarifyAnswer = { question: string; answer: string };

// Fetch up to 3 follow-up questions for the given description. Always
// resolves — on any error or non-OK response we return an empty array so
// the caller can proceed straight to generation. The spec is explicit
// that the user must never see an error from this step.
export async function fetchClarifyQuestions(description: string): Promise<string[]> {
  if (!description || description.trim().length === 0) return [];
  try {
    const res = await fetch("/api/clarify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description }),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { questions?: unknown };
    if (!Array.isArray(data.questions)) return [];
    return data.questions
      .filter((q): q is string => typeof q === "string" && q.trim().length > 0)
      .slice(0, 3);
  } catch {
    return [];
  }
}

// Combine the user's original description with their clarification
// answers in the structured form the spec calls for. Empty answers are
// rendered as "Not provided" so the LLM can still see which questions
// were asked even when the user skipped them.
export function combineDescriptionWithClarifications(
  description: string,
  qa: ClarifyAnswer[]
): string {
  if (qa.length === 0) return description;
  const lines = qa.map(({ question, answer }) => {
    const a = answer.trim().length === 0 ? "Not provided" : answer.trim();
    return `Q: ${question}\nA: ${a}`;
  });
  return `Original description: ${description}\n\nClarifications provided:\n${lines.join("\n\n")}`;
}

// Recording transcripts shorter than this likely don't contain enough
// detail for the model to ground its workflow on. The spec triggers
// clarification when *either* the recording duration is under 60s OR
// the transcript word count is below this threshold.
export const SHORT_TRANSCRIPT_WORD_THRESHOLD = 50;
export const SHORT_RECORDING_SECONDS = 60;

export function shouldClarifyRecording(opts: {
  durationSeconds: number;
  transcript: string;
}): boolean {
  if (opts.durationSeconds < SHORT_RECORDING_SECONDS) return true;
  const words = opts.transcript.trim().split(/\s+/).filter(Boolean).length;
  return words < SHORT_TRANSCRIPT_WORD_THRESHOLD;
}
