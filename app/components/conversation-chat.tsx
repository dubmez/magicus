"use client";

import { useEffect, useRef, useState } from "react";
import { Send, Loader2 } from "lucide-react";

const dmSans = { fontFamily: "var(--font-dm-sans), sans-serif" };

export type ChatTurn = { role: "assistant" | "user"; content: string };

// Reusable chat surface used by all three conversational paths. The
// caller owns the LLM round-trip and the running `turns` array — this
// component just renders, animates, and emits user submissions.
//
// Suggestion pills: tapping one calls onSubmit immediately with the
// pill text. They aren't pre-filled into the input — that would force
// users to confirm a button they already pressed once.
export function ConversationChat({
  turns,
  suggestions,
  busy,
  inputDisabled,
  placeholder = "Type your answer…",
  onSubmit,
}: {
  turns: ChatTurn[];
  // Pills shown beneath the latest assistant message. Empty array = none.
  suggestions: string[];
  // True while the next assistant turn is being fetched. We render a
  // typing-style indicator and disable the input.
  busy: boolean;
  // Independently disable the input (e.g. once isComplete fired and
  // the parent is transitioning to generation).
  inputDisabled?: boolean;
  placeholder?: string;
  onSubmit: (text: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const scrollerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to the latest message whenever turns or busy state
  // changes. The scroll happens inside the chat's own scrollable div,
  // not the page — the parent card stays put.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [turns, busy]);

  // Re-focus the input after each assistant turn so the user can keep
  // typing without clicking back into the field. Skipped when the
  // parent disables the input (e.g. transitioning to generation).
  useEffect(() => {
    if (busy || inputDisabled) return;
    inputRef.current?.focus();
  }, [busy, inputDisabled, turns.length]);

  const handleSubmit = () => {
    const text = draft.trim();
    if (!text || busy || inputDisabled) return;
    setDraft("");
    onSubmit(text);
  };

  const handleSuggestion = (text: string) => {
    if (busy || inputDisabled) return;
    onSubmit(text);
  };

  return (
    <div style={{ ...dmSans, display: "flex", flexDirection: "column", gap: 12 }}>
      <div
        ref={scrollerRef}
        style={{
          maxHeight: 360,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 10,
          paddingRight: 4,
        }}
      >
        {turns.map((t, i) => (
          <Bubble key={i} role={t.role} content={t.content} />
        ))}
        {busy && <TypingIndicator />}
      </div>

      {suggestions.length > 0 && !busy && !inputDisabled && (
        <div className="flex flex-wrap gap-2" style={{ marginTop: 2 }}>
          {suggestions.map((s, i) => (
            <button
              key={i}
              onClick={() => handleSuggestion(s)}
              className="hover:bg-[#D9E8C0] transition-colors magicus-chat-appear"
              style={{
                background: "#EBF4DD",
                color: "#547863",
                border: "1px solid #D4E6C4",
                padding: "6px 12px",
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 500,
                cursor: "pointer",
                animationDelay: `${i * 40}ms`,
              }}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2" style={{ marginTop: 4 }}>
        <input
          ref={inputRef}
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSubmit();
          }}
          disabled={busy || inputDisabled}
          placeholder={placeholder}
          aria-label="Type your answer"
          style={{
            flex: 1,
            background: "#FFFFFF",
            border: "1px solid #DCE3E5",
            borderRadius: 999,
            padding: "10px 16px",
            fontSize: 14,
            color: "#3B4953",
            fontFamily: "inherit",
            outline: "none",
            opacity: busy || inputDisabled ? 0.6 : 1,
          }}
        />
        <button
          onClick={handleSubmit}
          disabled={busy || inputDisabled || draft.trim().length === 0}
          aria-label="Send"
          className="transition-colors flex items-center justify-center"
          style={{
            background: "#E66B4D",
            color: "#FFFFFF",
            border: "none",
            borderRadius: 999,
            width: 38,
            height: 38,
            cursor:
              busy || inputDisabled || draft.trim().length === 0
                ? "not-allowed"
                : "pointer",
            opacity:
              busy || inputDisabled || draft.trim().length === 0 ? 0.55 : 1,
            flexShrink: 0,
          }}
        >
          <Send size={14} />
        </button>
      </div>
    </div>
  );
}

function Bubble({
  role,
  content,
}: {
  role: ChatTurn["role"];
  content: string;
}) {
  const isUser = role === "user";
  return (
    <div
      className="magicus-chat-appear flex"
      style={{
        justifyContent: isUser ? "flex-end" : "flex-start",
      }}
    >
      <div
        style={{
          maxWidth: "82%",
          background: isUser ? "#3B4953" : "#F7FAF2",
          color: isUser ? "#EBF4DD" : "#3B4953",
          padding: "10px 14px",
          borderRadius: 12,
          fontSize: 14,
          lineHeight: 1.5,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}
      >
        {content}
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div
      className="magicus-chat-appear flex"
      style={{ justifyContent: "flex-start" }}
    >
      <div
        className="flex items-center gap-2"
        style={{
          background: "#F7FAF2",
          color: "#90AB8B",
          padding: "10px 14px",
          borderRadius: 12,
          fontSize: 12,
        }}
      >
        <Loader2 size={12} className="animate-spin" />
        <span>thinking…</span>
      </div>
    </div>
  );
}
