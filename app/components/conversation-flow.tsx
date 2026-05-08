"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle } from "lucide-react";
import { ConversationChat, type ChatTurn } from "./conversation-chat";
import { PathPicker } from "./path-picker";
import { PathRecommendation } from "./path-recommendation";
import {
  fetchConversationTurn,
  transcriptForGeneration,
  type ConversationPath,
  type ConversationReply,
} from "@/lib/conversation";
import type { Workflow, LibraryCategory } from "@/lib/workflows";

const dmSans = { fontFamily: "var(--font-dm-sans), sans-serif" };

type Stage = "picker" | "chat" | "recommendation" | "fatal";

// Plain-language rationales for path-1 recommendations. Per-category
// rather than per-template; we want users to feel the recommendation
// connects to what they said, but generating a tailored line per turn
// would mean another LLM round-trip on the critical path.
const CATEGORY_RATIONALE: Record<LibraryCategory, string> = {
  solo_founder:
    "You're juggling a lot solo — this template covers a high-leverage area for founders.",
  gtm_operator:
    "Sounds like sales / outbound is where time goes — this is a common starting point for GTM teams.",
  ops_manager:
    "Operations work has the most repetition to claw back — this template is where Ops teams usually start.",
  ecommerce_ops:
    "E-commerce ops has clear repeatable flows — this template is one of the highest-leverage to automate first.",
};

// Owns the post-submit experience: path picker → conversation → either
// the path-1 recommendation card or a delegation to the parent's
// generation hook (paths 2 / 3). The parent renders this inside its
// own card chrome so the transition feels in-place.
export function ConversationFlow({
  description,
  libraryWorkflows,
  onAdaptLibrary,
  onBrowseLibrary,
  onGenerate,
}: {
  description: string;
  // Seeded library workflows the parent has loaded. We filter by
  // `category` to pick the recommended one for path 1.
  libraryWorkflows: Workflow[];
  // Path-1 "Adapt this" — parent handles the actual clone-to-canvas.
  onAdaptLibrary: (libraryId: string) => void;
  // Path-1 "Show me other templates" — parent navigates to Library.
  onBrowseLibrary: () => void;
  // Paths 2/3 completion. The parent runs the actual generation; we
  // pass it the full conversation transcript so the LLM gets every
  // detail captured across turns.
  onGenerate: (transcript: string) => Promise<void>;
}) {
  const [stage, setStage] = useState<Stage>("picker");
  const [path, setPath] = useState<ConversationPath | null>(null);
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recommendation, setRecommendation] = useState<Workflow | null>(null);
  const [recommendationCategory, setRecommendationCategory] =
    useState<LibraryCategory | null>(null);

  // Track whether the first turn has been requested so component
  // re-renders don't double-fetch. StrictMode in dev runs effects
  // twice; this ref keeps us idempotent.
  const firstTurnRequestedRef = useRef(false);

  const pickRecommendation = (category: LibraryCategory): Workflow | null => {
    const inCategory = libraryWorkflows.filter(
      (w) => w.category === category && w.isSeeded
    );
    return inCategory[0] ?? null;
  };

  const advanceTurn = async (
    chosenPath: ConversationPath,
    history: ChatTurn[]
  ) => {
    setBusy(true);
    setError(null);
    let reply: ConversationReply | null = null;
    try {
      reply = await fetchConversationTurn(chosenPath, description, history);
    } catch {
      setBusy(false);
      setError("Couldn't reach the conversation service. Try again.");
      return;
    }
    if (!reply) {
      setBusy(false);
      setError("The model didn't respond. Try again.");
      return;
    }
    // Order matters: append assistant turn first, then check completion
    // so the user sees the closing message before any transition.
    setTurns([...history, { role: "assistant", content: reply.message }]);
    setSuggestions(reply.suggestions);
    setBusy(false);

    if (reply.isComplete) {
      if (chosenPath === "explore") {
        const cat = reply.recommendationCategory;
        if (!cat) {
          // Model said complete but didn't give us a category — treat
          // as a soft failure and let the user retry from the picker.
          setError(
            "Couldn't pick a starting template — try answering one more question or pick a different path."
          );
          return;
        }
        const wf = pickRecommendation(cat);
        if (!wf) {
          setError(
            "We don't have a matching template yet — try 'Map a workflow quickly' instead."
          );
          return;
        }
        setRecommendation(wf);
        setRecommendationCategory(cat);
        setStage("recommendation");
        return;
      }
      // Paths 2/3: hand off to the parent's generator.
      const transcript = transcriptForGeneration(description, [
        ...history,
        { role: "assistant", content: reply.message },
      ]);
      try {
        await onGenerate(transcript);
      } catch {
        setError("Couldn't generate the workflow. Try again.");
      }
    }
  };

  const handlePick = (chosen: ConversationPath) => {
    if (firstTurnRequestedRef.current) return;
    firstTurnRequestedRef.current = true;
    setPath(chosen);
    setStage("chat");
    void advanceTurn(chosen, []);
  };

  const handleUserMessage = (text: string) => {
    if (!path) return;
    const next: ChatTurn[] = [...turns, { role: "user", content: text }];
    setTurns(next);
    void advanceTurn(path, next);
  };

  // If the parent rerenders with a different description (rare but
  // possible — e.g. the user backed out and resubmitted with new text),
  // reset the picker. We compare by description string only; if it
  // hasn't changed, leave state alone so React re-mounts don't wipe an
  // in-flight conversation.
  useEffect(() => {
    firstTurnRequestedRef.current = false;
    setStage("picker");
    setPath(null);
    setTurns([]);
    setSuggestions([]);
    setError(null);
    setRecommendation(null);
    setRecommendationCategory(null);
  }, [description]);

  return (
    <div style={{ ...dmSans }}>
      {error && (
        <div
          role="alert"
          className="flex items-start gap-2"
          style={{
            marginBottom: 12,
            padding: "8px 12px",
            background: "#FDECEC",
            border: "1px solid #E5A8A8",
            borderRadius: 8,
            fontSize: 12,
            color: "#8B2A2A",
            lineHeight: 1.4,
          }}
        >
          <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>{error}</span>
        </div>
      )}

      {stage === "picker" && (
        <PathPicker
          description={description}
          selected={path}
          onPick={handlePick}
        />
      )}

      {stage === "chat" && (
        <ConversationChat
          turns={turns}
          suggestions={suggestions}
          busy={busy}
          onSubmit={handleUserMessage}
        />
      )}

      {stage === "recommendation" && recommendation && (
        <PathRecommendation
          workflow={recommendation}
          rationale={
            recommendationCategory
              ? CATEGORY_RATIONALE[recommendationCategory]
              : "This looks like a strong place to start."
          }
          onAdapt={() => onAdaptLibrary(recommendation.libraryId ?? recommendation.id)}
          onBrowseLibrary={onBrowseLibrary}
        />
      )}

      {stage === "fatal" && (
        <div style={{ fontSize: 13, color: "#8B2A2A" }}>
          Something went wrong with this conversation. Refresh and try again.
        </div>
      )}
    </div>
  );
}
