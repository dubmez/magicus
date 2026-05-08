// Shared types + small client helpers for the conversational workflow
// capture flow. The /api/conversation route owns the LLM round-trip;
// this module lives between caller and route.

import type { LibraryCategory } from "@/lib/workflows";

export type ConversationPath = "explore" | "quick" | "deep";

export type ChatTurn = { role: "assistant" | "user"; content: string };

export type ConversationReply = {
  message: string;
  suggestions: string[];
  isComplete: boolean;
  recommendationCategory: LibraryCategory | null;
  progressSummary: string | null;
};

// Render the conversation as plain text suitable for the workflow
// generation prompt. The original description is kept first so the
// downstream LLM gets the user's own phrasing before the structured
// follow-ups.
export function transcriptForGeneration(
  description: string,
  history: ChatTurn[]
): string {
  if (history.length === 0) return description;
  const lines = [
    `Original description: ${description}`,
    "",
    "Conversation:",
  ];
  for (const t of history) {
    const tag = t.role === "assistant" ? "Magicus" : "User";
    lines.push(`${tag}: ${t.content}`);
  }
  return lines.join("\n");
}

// POST helper used by the chat hosts. Returns the parsed reply or
// throws — callers render an inline error and let the user retry.
export async function fetchConversationTurn(
  path: ConversationPath,
  description: string,
  history: ChatTurn[]
): Promise<ConversationReply> {
  const res = await fetch("/api/conversation", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, description, history }),
  });
  if (!res.ok) {
    throw new Error(`conversation turn failed: ${res.status}`);
  }
  const data = (await res.json()) as Partial<ConversationReply> & {
    error?: string;
  };
  if (data.error) throw new Error(data.error);
  return {
    message: typeof data.message === "string" ? data.message : "",
    suggestions: Array.isArray(data.suggestions) ? data.suggestions : [],
    isComplete: data.isComplete === true,
    recommendationCategory:
      (data.recommendationCategory as LibraryCategory | null | undefined) ??
      null,
    progressSummary: data.progressSummary ?? null,
  };
}
