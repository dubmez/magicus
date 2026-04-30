"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles, Send, Loader2, X, ArrowRight } from "lucide-react";

const dmSerif = { fontFamily: "var(--font-dm-serif), serif", fontStyle: "italic" as const };

type Stage = "idle" | "asking" | "generating";

export function Landing({
  mode,
  onMap,
  onCancel,
  onSkip,
}: {
  mode: "fullscreen" | "modal";
  onMap: (description: string, clarification?: string) => void;
  onCancel?: () => void;
  onSkip?: () => void;
}) {
  const [stage, setStage] = useState<Stage>("idle");
  const [text, setText] = useState("");
  const [clarification, setClarification] = useState("");
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { taRef.current?.focus(); }, []);

  const submit = () => {
    if (stage === "idle") {
      if (text.trim().length === 0) return;
      setStage("asking");
    } else if (stage === "asking") {
      setStage("generating");
      setTimeout(() => { onMap(text, clarification); }, 1100);
    }
  };

  const skipClarification = () => {
    setStage("generating");
    setTimeout(() => { onMap(text); }, 900);
  };

  const content = (
    <div
      style={{
        width: "min(720px, 100%)",
        background: "#FFFFFF",
        borderRadius: 24,
        border: "1px solid #EBF4DD",
        padding: "44px 44px 32px",
        position: "relative",
        boxShadow: "0px 12px 48px rgba(59, 73, 83, 0.16)",
        fontFamily: "var(--font-dm-sans), sans-serif",
      }}
    >
      {mode === "modal" && onCancel && (
        <button
          onClick={onCancel}
          className="absolute hover:bg-[#EBF4DD] rounded-md p-2"
          style={{ top: 12, right: 12, color: "#547863" }}
          aria-label="Close"
        >
          <X size={18} />
        </button>
      )}

      <div
        className="flex items-center gap-2"
        style={{ marginBottom: 14, color: "#547863", fontSize: 12, letterSpacing: 0.6 }}
      >
        <Sparkles size={14} />
        <span style={{ textTransform: "uppercase", fontWeight: 500 }}>
          {mode === "fullscreen" ? "Welcome to magicus" : "Map a new workflow"}
        </span>
      </div>

      <h1
        style={{
          ...dmSerif,
          fontSize: 38,
          color: "#3B4953",
          lineHeight: 1.1,
          marginBottom: 12,
          letterSpacing: -0.5,
        }}
      >
        {stage === "asking"
          ? "One quick clarification"
          : "Describe a workflow and I'll map it."}
      </h1>
      <p style={{ fontSize: 15, color: "#547863", lineHeight: 1.5, marginBottom: 24 }}>
        {stage === "asking"
          ? "Who owns this workflow, and what tools does it touch? Skip if you'd rather I guess."
          : "Tell me what happens, who's involved, and the tools you use. Magicus turns it into a butterfly card you can refine, chain, and export."}
      </p>

      {stage === "asking" ? (
        <>
          <div
            style={{
              background: "#F7FAF2",
              border: "1px solid #EBF4DD",
              borderRadius: 12,
              padding: 14,
              marginBottom: 12,
              fontSize: 13,
              color: "#3B4953",
              lineHeight: 1.45,
            }}
          >
            <div
              style={{
                fontSize: 11,
                color: "#547863",
                letterSpacing: 0.6,
                textTransform: "uppercase",
                marginBottom: 6,
              }}
            >
              Your description
            </div>
            {text}
          </div>
          <input
            value={clarification}
            onChange={(e) => setClarification(e.target.value)}
            placeholder="e.g. Owned by Ops; uses Notion + Slack"
            autoFocus
            onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
            style={{
              width: "100%",
              background: "#F7FAF2",
              border: "1px solid #EBF4DD",
              borderRadius: 12,
              padding: "12px 14px",
              fontSize: 14,
              color: "#3B4953",
              outline: "none",
              fontFamily: "inherit",
            }}
          />
        </>
      ) : (
        <textarea
          ref={taRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={stage !== "idle"}
          placeholder="When a customer requests a refund, our support team checks eligibility, processes it in Stripe, and emails the customer..."
          rows={5}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit(); }}
          style={{
            width: "100%",
            background: "#F7FAF2",
            border: "1px solid #EBF4DD",
            borderRadius: 12,
            padding: "14px 16px",
            fontSize: 14,
            color: "#3B4953",
            outline: "none",
            resize: "none",
            fontFamily: "inherit",
            lineHeight: 1.5,
          }}
        />
      )}

      <div className="flex items-center justify-between" style={{ marginTop: 18 }}>
        <div style={{ fontSize: 12, color: "#90AB8B" }}>
          {stage === "idle" && "Tip: ⌘ + Enter to map"}
          {stage === "asking" && "Hit Enter to map · or skip"}
          {stage === "generating" && "Mapping into a butterfly…"}
        </div>
        <div className="flex items-center gap-2">
          {stage === "asking" && (
            <button
              onClick={skipClarification}
              className="hover:bg-[#EBF4DD] transition-colors"
              style={{
                background: "transparent",
                color: "#547863",
                padding: "10px 16px",
                borderRadius: 999,
                fontSize: 13,
                border: "1px solid #EBF4DD",
              }}
            >
              Skip
            </button>
          )}
          {mode === "fullscreen" && stage === "idle" && onSkip && (
            <button
              onClick={onSkip}
              className="flex items-center gap-1 hover:underline"
              style={{ color: "#547863", fontSize: 13, padding: "10px 12px" }}
            >
              Or explore the demo workflows
              <ArrowRight size={13} />
            </button>
          )}
          <button
            onClick={submit}
            disabled={stage === "generating" || (stage === "idle" && text.trim().length === 0)}
            className="flex items-center gap-2 transition-opacity hover:opacity-90"
            style={{
              background: "#3B4953",
              color: "#EBF4DD",
              padding: "11px 18px",
              borderRadius: 999,
              fontSize: 13,
              fontWeight: 500,
              opacity:
                stage === "generating" || (stage === "idle" && text.trim().length === 0) ? 0.5 : 1,
              cursor:
                stage === "generating" || (stage === "idle" && text.trim().length === 0)
                  ? "not-allowed"
                  : "pointer",
            }}
          >
            {stage === "generating" ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Mapping
              </>
            ) : (
              <>
                <Send size={14} />
                Map it
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );

  if (mode === "fullscreen") {
    return (
      <div
        className="fixed inset-0 flex items-center justify-center p-6"
        style={{
          background: "#F7FAF2",
          backgroundImage: "radial-gradient(rgba(144, 171, 139, 0.4) 1.2px, transparent 1.2px)",
          backgroundSize: "28px 28px",
          zIndex: 50,
        }}
      >
        <div className="absolute flex items-center gap-3" style={{ top: 28, left: 32 }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              background: "#3B4953",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#EBF4DD",
              ...dmSerif,
              fontSize: 16,
            }}
          >
            m
          </div>
          <div style={{ ...dmSerif, fontSize: 22, color: "#3B4953" }}>magicus</div>
        </div>
        {content}
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 flex items-center justify-center p-6"
      style={{ background: "rgba(59, 73, 83, 0.4)", zIndex: 90 }}
      onClick={onCancel}
    >
      <div onClick={(e) => e.stopPropagation()}>{content}</div>
    </div>
  );
}
