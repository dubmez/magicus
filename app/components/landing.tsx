"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Sparkles, Send, Loader2, X, ArrowRight, Mic, AlertCircle, AlertTriangle } from "lucide-react";
import { useRequireAuth } from "@/lib/auth-context";
import { LogoMark } from "./logo";
import { ConversationFlow } from "./conversation-flow";
import type { Workflow } from "@/lib/workflows";

const dmSerif = {
  fontFamily: "var(--font-dm-serif), serif",
  fontStyle: "italic" as const,
};

// Submission stages mirror the landing-hero PromptBox: after the user
// clicks Map it the card hands off to ConversationFlow (path picker →
// chat → recommendation or generation). `generating` covers the brief
// window while the parent's onMap resolves.
type Stage = "idle" | "conversation" | "generating";

type SpeechRecognitionResultLike = {
  isFinal: boolean;
  0: { transcript: string };
};
type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
};
type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
};
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getSpeechRecognition(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function Landing({
  mode,
  onMap,
  onCancel,
  onSkip,
  onRecord,
  libraryWorkflows,
  onAdaptLibrary,
  onBrowseLibrary,
}: {
  mode: "fullscreen" | "modal";
  // Paths 2/3 generation. Transcript is the full conversation rendered
  // as plain text. Optional for back-compat with fullscreen-mode call
  // sites that don't (yet) wire conversational capture.
  onMap: (description: string, transcript?: string) => void | Promise<void>;
  onCancel?: () => void;
  onSkip?: () => void;
  onRecord?: () => void;
  libraryWorkflows: Workflow[];
  // Path-1 outcome handlers — modal callsite wires these to the
  // canvas's adapt/library navigation.
  onAdaptLibrary: (libraryId: string) => void;
  onBrowseLibrary: () => void;
}) {
  const [stage, setStage] = useState<Stage>("idle");
  const [text, setText] = useState("");
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const baseTextRef = useRef("");
  const denyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const guard = useRequireAuth();

  useEffect(() => {
    taRef.current?.focus();
  }, []);

  // Post-OAuth rehydrate: when the user submitted text on the unauthed
  // landing hero, we stashed it in sessionStorage before the auth gate
  // redirected to Google. Once back, the page opens this modal — we
  // rehydrate the text and auto-advance to the conversation stage so
  // the user lands on the path picker exactly where they would have
  // been if they'd been signed in already.
  useEffect(() => {
    let pending: string | null = null;
    try {
      pending = sessionStorage.getItem("magicus_pending_input");
    } catch { /* storage disabled — fall through with empty text */ }
    if (!pending || pending.trim().length === 0) return;
    try { sessionStorage.removeItem("magicus_pending_input"); } catch { /* ignore */ }
    setText(pending);
    setStage("conversation");
  }, []);

  useEffect(() => {
    setVoiceSupported(getSpeechRecognition() !== null);
    return () => {
      recognitionRef.current?.abort();
      if (denyTimerRef.current) clearTimeout(denyTimerRef.current);
    };
  }, []);

  // ESC closes the modal variant
  useEffect(() => {
    if (mode !== "modal" || !onCancel) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onCancel(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode, onCancel]);

  // Lock body scroll while the modal variant is open.
  useEffect(() => {
    if (mode !== "modal") return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [mode]);

  const stopRecording = () => {
    recognitionRef.current?.stop();
  };

  const startRecording = () => {
    const Ctor = getSpeechRecognition();
    if (!Ctor) return;
    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";

    baseTextRef.current = text.length > 0 && !text.endsWith(" ") ? text + " " : text;

    rec.onresult = (e) => {
      let interim = "";
      let final = "";
      for (let i = 0; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) final += r[0].transcript;
        else interim += r[0].transcript;
      }
      setText(baseTextRef.current + final + interim);
    };
    rec.onend = () => {
      setIsRecording(false);
      recognitionRef.current = null;
    };
    rec.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        setPermissionDenied(true);
        if (denyTimerRef.current) clearTimeout(denyTimerRef.current);
        denyTimerRef.current = setTimeout(() => setPermissionDenied(false), 6000);
      }
      setIsRecording(false);
    };

    recognitionRef.current = rec;
    setPermissionDenied(false);
    try {
      rec.start();
      setIsRecording(true);
    } catch {
      setIsRecording(false);
      recognitionRef.current = null;
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
      return;
    }
    // Voice input creates data — gate it.
    guard(() => startRecording());
  };

  const runGeneration = async (transcript: string) => {
    setStage("generating");
    try {
      await onMap(text, transcript);
    } catch {
      setSubmitError("Couldn't generate a workflow — check your connection and try again.");
      setStage("conversation");
    }
  };

  const doSubmit = () => {
    if (stage !== "idle" || text.trim().length === 0) return;
    if (isRecording) stopRecording();
    setSubmitError(null);
    setStage("conversation");
  };

  const submit = () => {
    if (text.trim().length === 0) return;
    // Auth-gate the entire submission. After sign-in the gate replays doSubmit
    // automatically — no lost context.
    guard(() => { doSubmit(); });
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
        style={{
          marginBottom: 14,
          color: "#547863",
          fontSize: 12,
          letterSpacing: 0.6,
        }}
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
        Describe a workflow and I'll map it.
      </h1>
      <p
        style={{
          fontSize: 15,
          color: "#547863",
          lineHeight: 1.5,
          marginBottom: 24,
        }}
      >
        Tell me what happens, who's involved, and the tools you use. Magicus
        maps your workflow so you can refine, chain, and automate.
      </p>

      {stage === "conversation" || stage === "generating" ? (
        <ConversationFlow
          description={text}
          libraryWorkflows={libraryWorkflows}
          onAdaptLibrary={onAdaptLibrary}
          onBrowseLibrary={onBrowseLibrary}
          onGenerate={(transcript) => runGeneration(transcript)}
        />
      ) : (
        <>
      <textarea
        ref={taRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={stage !== "idle"}
        placeholder={
          isRecording
            ? "Listening…"
            : "When a customer requests a refund, our support team checks eligibility, processes it in Stripe, and emails the customer..."
        }
        rows={5}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
        }}
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

      {permissionDenied && (
        <div
          role="alert"
          className="flex items-start gap-2"
          style={{
            marginTop: 10,
            padding: "8px 12px",
            background: "#FEF3E2",
            border: "1px solid #F5C28C",
            borderRadius: 8,
            fontSize: 12,
            color: "#8A4B0F",
            lineHeight: 1.4,
          }}
        >
          <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>
            <strong style={{ fontWeight: 600 }}>Microphone access denied.</strong>{" "}
            Enable microphone in your browser settings, then try again.
          </span>
        </div>
      )}

      {submitError && (
        <div
          role="alert"
          className="flex items-start gap-2"
          style={{
            marginTop: 10,
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
          <span>{submitError}</span>
        </div>
      )}

      <div
        className="flex items-center justify-between"
        style={{ marginTop: 18 }}
      >
        <div className="flex items-center gap-3" style={{ fontSize: 12, color: "#90AB8B" }}>
          {stage === "idle" && (
            <>
              <span>Tip: ⌘/Ctrl + Enter to map</span>
              {onRecord && (
                <>
                  <span style={{ color: "#EBF4DD" }}>·</span>
                  <button
                    onClick={() => {
                      // Preserve typed text — confirm before discarding so a
                      // long description isn't lost to a stray click.
                      if (
                        text.trim().length > 0 &&
                        !window.confirm(
                          "Discard your description and switch to screen recording?"
                        )
                      ) {
                        return;
                      }
                      onRecord();
                    }}
                    className="hover:underline"
                    style={{
                      background: "transparent",
                      color: "#547863",
                      border: "none",
                      padding: 0,
                      fontSize: 12,
                      cursor: "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    Record screen instead
                  </button>
                </>
              )}
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          {mode === "fullscreen" && onSkip && (
            <button
              onClick={onSkip}
              className="flex items-center gap-1 hover:underline"
              style={{ color: "#547863", fontSize: 13, padding: "10px 12px" }}
            >
              Browse example workflows
              <ArrowRight size={13} />
            </button>
          )}
          {voiceSupported && (
            <button
              type="button"
              onClick={toggleRecording}
              disabled={stage !== "idle"}
              className={isRecording ? "magicus-mic-pulse" : "hover:bg-[#EBF4DD] transition-colors"}
              aria-label={isRecording ? "Stop recording" : "Start voice input"}
              aria-pressed={isRecording}
              style={{
                background: "transparent",
                color: isRecording ? "#F59E0B" : "#547863",
                border: "none",
                padding: "11px",
                borderRadius: 999,
                cursor: stage !== "idle" ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                opacity: stage !== "idle" ? 0.5 : 1,
              }}
            >
              <Mic size={16} />
            </button>
          )}
          <button
            onClick={submit}
            disabled={text.trim().length === 0}
            className="flex items-center gap-2 transition-opacity hover:opacity-90"
            style={{
              background: "#3B4953",
              color: "#EBF4DD",
              padding: "11px 18px",
              borderRadius: 999,
              fontSize: 13,
              fontWeight: 500,
              opacity: text.trim().length === 0 ? 0.5 : 1,
              cursor: text.trim().length === 0 ? "not-allowed" : "pointer",
            }}
          >
            <Send size={14} />
            Map it
          </button>
        </div>
      </div>
        </>
      )}
    </div>
  );

  if (mode === "fullscreen") {
    return (
      <div
        className="fixed inset-0 flex items-center justify-center p-6"
        style={{
          background: "#F7FAF2",
          backgroundImage:
            "radial-gradient(rgba(144, 171, 139, 0.4) 1.2px, transparent 1.2px)",
          backgroundSize: "28px 28px",
          zIndex: 50,
        }}
      >
        <Link
          href="/"
          aria-label="Go home"
          className="absolute flex items-center gap-2.5"
          style={{ top: 28, left: 32, textDecoration: "none" }}
        >
          <LogoMark variant="sage" size={28} />
          <div style={{ ...dmSerif, fontSize: 22, color: "#3B4953" }}>
            magicus
          </div>
        </Link>
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
