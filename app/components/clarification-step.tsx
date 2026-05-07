"use client";

import { useState } from "react";
import { Loader2, Send } from "lucide-react";
import type { ClarifyAnswer } from "@/lib/clarify";

const dmSans = { fontFamily: "var(--font-dm-sans), sans-serif" };

// Coral accent — same hex as landing-hero / brand spec. Inline rather than
// in a tokens file so this component can be lifted into other surfaces
// without dragging the landing-hero palette along.
const CORAL = "#E66B4D";
const CORAL_DIM = "#F4A294";

// Renders the labelled question fields + Map it / Skip controls. The
// caller owns the LLM round-trip and the post-clarify generation; this
// component is only responsible for collecting answers and surfacing
// the user's choice.
//
// Behaviour:
//   - Each input is optional. Blank answers are submitted as the empty
//     string; the helper combineDescriptionWithClarifications() turns
//     them into "Not provided" before sending to the LLM.
//   - "Map it" is enabled even with all fields blank — the spec says
//     don't block users who want to skip individual fields.
//   - "Skip questions" is a separate path that submits no answers at
//     all (caller distinguishes via a different callback).
export function ClarificationStep({
  questions,
  onSubmit,
  onSkip,
  busy = false,
}: {
  questions: string[];
  onSubmit: (answers: ClarifyAnswer[]) => void;
  onSkip: () => void;
  // True while the post-clarify generation is in flight — shows a
  // spinner on the primary button and disables both controls.
  busy?: boolean;
}) {
  const [answers, setAnswers] = useState<string[]>(() =>
    questions.map(() => "")
  );

  const updateAnswer = (idx: number, value: string) => {
    setAnswers((prev) => {
      const next = [...prev];
      next[idx] = value;
      return next;
    });
  };

  const handleSubmit = () => {
    if (busy) return;
    const qa: ClarifyAnswer[] = questions.map((q, i) => ({
      question: q,
      answer: answers[i] ?? "",
    }));
    onSubmit(qa);
  };

  return (
    <div style={{ ...dmSans }}>
      <div
        style={{
          fontSize: 13,
          color: "#547863",
          marginBottom: 14,
          lineHeight: 1.45,
        }}
      >
        A few quick questions to make your workflow more precise:
      </div>

      <div className="flex flex-col gap-3">
        {questions.map((q, i) => (
          <div key={i} className="flex flex-col">
            <label
              style={{
                fontSize: 13,
                color: "#3B4953",
                fontWeight: 500,
                lineHeight: 1.4,
                marginBottom: 6,
              }}
            >
              {q}
            </label>
            <input
              type="text"
              value={answers[i] ?? ""}
              onChange={(e) => updateAnswer(i, e.target.value)}
              disabled={busy}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSubmit();
              }}
              style={{
                background: "#FFFFFF",
                border: "1px solid #DCE3E5",
                borderRadius: 8,
                padding: "9px 12px",
                fontSize: 14,
                color: "#3B4953",
                fontFamily: "inherit",
                outline: "none",
              }}
            />
            <div
              style={{
                fontSize: 11,
                color: "#90AB8B",
                marginTop: 4,
                fontStyle: "italic",
              }}
            >
              Optional — skip if not relevant
            </div>
          </div>
        ))}
      </div>

      <div
        className="flex items-center justify-between gap-3"
        style={{ marginTop: 18 }}
      >
        <button
          type="button"
          onClick={onSkip}
          disabled={busy}
          className="hover:underline transition-opacity"
          style={{
            background: "transparent",
            color: "#90AB8B",
            fontSize: 13,
            fontWeight: 400,
            border: "none",
            padding: "6px 4px",
            cursor: busy ? "not-allowed" : "pointer",
          }}
        >
          Skip questions →
        </button>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={busy}
          className="flex items-center gap-2 transition-colors"
          style={{
            background: busy ? CORAL_DIM : CORAL,
            color: "#FFFFFF",
            padding: "10px 20px",
            borderRadius: 999,
            fontSize: 14,
            fontWeight: 500,
            border: "none",
            cursor: busy ? "wait" : "pointer",
          }}
        >
          {busy ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              Mapping
            </>
          ) : (
            <>
              <Send size={14} />
              Map it →
            </>
          )}
        </button>
      </div>
    </div>
  );
}
