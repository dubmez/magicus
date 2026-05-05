"use client";

import { useEffect, useRef, useState } from "react";
import {
  Sparkles,
  Mic,
  Video,
  ArrowRight,
  Send,
  Loader2,
  AlertCircle,
  AlertTriangle,
  Link2,
  Zap,
} from "lucide-react";
import { useAuth, useRequireAuth } from "@/lib/auth-context";
import { AnimatedButterfly } from "./animated-butterfly";

const dmSerif = {
  fontFamily: "var(--font-dm-serif), serif",
  fontStyle: "italic" as const,
};
const dmSans = { fontFamily: "var(--font-dm-sans), sans-serif" };

const PLACEHOLDERS = [
  "Every Monday I check dashboards, flag issues, and brief the team — three hours I want back…",
  "When a new client signs, I set up Notion, send the welcome email, and schedule the kickoff — all manually…",
  "I review inbound leads every morning, score them, and decide who gets a call — still doing it by hand…",
];

// ─── Speech recognition (re-declared locally to avoid coupling to landing.tsx)
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

// ─── Top bar ───────────────────────────────────────────────────────────────
function HeroHeader() {
  const { openGate } = useAuth();
  return (
    <header
      className="flex items-center justify-between"
      style={{ padding: "24px 32px", position: "relative", zIndex: 2 }}
    >
      <div className="flex items-center gap-3">
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
        <div
          style={{
            ...dmSerif,
            fontSize: 22,
            color: "#3B4953",
            letterSpacing: -0.2,
          }}
        >
          magicus
        </div>
      </div>
      <button
        onClick={() => openGate()}
        className="hover:bg-[#EBF4DD] transition-colors"
        style={{
          background: "transparent",
          color: "#3B4953",
          padding: "6px 14px",
          borderRadius: 999,
          fontSize: 13,
          fontWeight: 500,
          border: "1px solid transparent",
        }}
      >
        Sign in
      </button>
    </header>
  );
}

// ─── Hero (eyebrow + headline + subhead + prompt + browse) ────────────────
function HeroSection({
  onMap,
  onBrowseExamples,
  onRecord,
}: {
  onMap: (description: string) => Promise<void>;
  onBrowseExamples: () => void;
  onRecord: () => void;
}) {
  return (
    <section
      className="relative flex-1 flex items-center justify-center"
      style={{
        padding: "48px 24px 80px",
        // Layered: dot grid texture on top, sage glow in middle, cream base.
        // The dots persist across the gradient so the whole hero reads as one
        // soft, considered surface — not a separate panel.
        background: `
          radial-gradient(rgba(144, 171, 139, 0.4) 1.2px, transparent 1.2px),
          radial-gradient(ellipse 110% 80% at center 38%, rgba(44, 74, 62, 0.22) 0%, rgba(44, 74, 62, 0.08) 35%, rgba(247, 250, 242, 0) 65%),
          #F7FAF2
        `,
        backgroundSize: "28px 28px, auto, auto",
        backgroundPosition: "0 0, center, 0 0",
        backgroundRepeat: "repeat, no-repeat, no-repeat",
      }}
    >
      <div
        className="w-full max-w-[760px] mx-auto flex flex-col items-center text-center"
        style={{ position: "relative", zIndex: 1 }}
      >
        <div
          style={{
            color: "#547863",
            fontSize: 12,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            fontWeight: 500,
            marginBottom: 20,
          }}
        >
          Workflow intelligence for the AI era
        </div>

        <h1
          className="text-[40px] md:text-[56px] lg:text-[64px]"
          style={{
            ...dmSerif,
            color: "#3B4953",
            lineHeight: 1.05,
            letterSpacing: -1,
            marginBottom: 20,
            maxWidth: 720,
          }}
        >
          Own your workflow. Get ahead of AI
        </h1>

        <p
          className="text-[16px] md:text-[18px]"
          style={{
            color: "#547863",
            lineHeight: 1.55,
            maxWidth: 520,
            marginBottom: 36,
          }}
        >
          You know how things really work. Record it once - Magicus maps,
          scores, and identifies exactly where you need AI agents. You bring the
          magic.
        </p>

        <PromptBox onMap={onMap} onRecord={onRecord} />

        <button
          onClick={onBrowseExamples}
          className="hover:underline flex items-center gap-1 mt-6"
          style={{
            background: "transparent",
            color: "#90AB8B",
            fontSize: 13,
            fontWeight: 400,
            border: "none",
            padding: "8px 12px",
          }}
        >
          Or browse example workflows
          <ArrowRight size={13} />
        </button>
      </div>
    </section>
  );
}

// ─── Prompt box ────────────────────────────────────────────────────────────
type Mode = "describe" | "voice" | "record";
type Stage = "idle" | "generating";

function PromptBox({
  onMap,
  onRecord,
}: {
  onMap: (description: string) => Promise<void>;
  onRecord: () => void;
}) {
  const [text, setText] = useState("");
  const [mode, setMode] = useState<Mode>("describe");
  const [stage, setStage] = useState<Stage>("idle");
  const [phIdx, setPhIdx] = useState(0);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [interimTranscript, setInterimTranscript] = useState("");

  const taRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const baseTextRef = useRef("");
  const denyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const guard = useRequireAuth();

  // Detect voice support once on mount.
  useEffect(() => {
    setVoiceSupported(getSpeechRecognition() !== null);
    return () => {
      recognitionRef.current?.abort();
      if (denyTimerRef.current) clearTimeout(denyTimerRef.current);
    };
  }, []);

  // Cycle through example placeholders every 4s while the textarea is empty.
  // We render the placeholder as an absolutely-positioned overlay so we can
  // control the fade-in via a CSS keyframe (the native `placeholder` attribute
  // can't be animated).
  useEffect(() => {
    if (text.length > 0) return;
    const t = setInterval(() => {
      setPhIdx((i) => (i + 1) % PLACEHOLDERS.length);
    }, 4000);
    return () => clearInterval(t);
  }, [text.length]);

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

    baseTextRef.current =
      text.length > 0 && !text.endsWith(" ") ? text + " " : text;

    rec.onresult = (e) => {
      let interim = "";
      let final = "";
      for (let i = 0; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) final += r[0].transcript;
        else interim += r[0].transcript;
      }
      // Live transcript shown in voice mode; final commits to the textarea.
      setText(baseTextRef.current + final);
      setInterimTranscript(interim);
    };
    rec.onend = () => {
      setIsRecording(false);
      setInterimTranscript("");
      recognitionRef.current = null;
    };
    rec.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        setPermissionDenied(true);
        if (denyTimerRef.current) clearTimeout(denyTimerRef.current);
        denyTimerRef.current = setTimeout(
          () => setPermissionDenied(false),
          6000,
        );
      }
      setIsRecording(false);
      setInterimTranscript("");
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

  // Switch modes. Switching INTO voice triggers recording (gated by auth);
  // switching OUT of voice (or back to describe) stops recording and surfaces
  // the transcript in the textarea. Record is a stub for now.
  const switchMode = (next: Mode) => {
    if (next === mode) {
      // Clicking the active mode toggles voice off if recording.
      if (next === "voice" && isRecording) {
        stopRecording();
        setMode("describe");
      }
      return;
    }
    if (mode === "voice" && isRecording) stopRecording();

    if (next === "record") {
      // Record launches the dedicated full-page recording flow. Auth-gated:
      // unauthed users sign in first, then drop straight into the prep screen.
      guard(() => onRecord());
      return;
    }

    setMode(next);
    if (next === "voice") {
      // Voice creates data, so it's gated. Authenticated users start recording
      // immediately; unauthed users see the gate and recording starts after.
      guard(() => startRecording());
    }
  };

  const doSubmit = async () => {
    if (stage !== "idle" || text.trim().length === 0) return;
    if (isRecording) stopRecording();
    setSubmitError(null);
    setStage("generating");
    try {
      await onMap(text);
    } catch {
      setSubmitError(
        "Couldn't generate a workflow — check your connection and try again.",
      );
      setStage("idle");
    }
  };

  const submit = () => {
    if (text.trim().length === 0) return;
    // The closure captures the current `text`; if the user is unauthed the
    // gate replays this exact callback after sign-in, so the typed text
    // survives the round-trip.
    guard(() => {
      void doSubmit();
    });
  };

  const submitDisabled = text.trim().length === 0 || stage === "generating";
  const showVoiceUI = mode === "voice";

  return (
    <div
      className="w-full"
      style={{
        maxWidth: 680,
        background: "#FFFFFF",
        border: "1px solid #EBF4DD",
        borderRadius: 20,
        padding: "20px 24px",
        boxShadow: "0 8px 40px rgba(59, 73, 83, 0.12)",
        ...dmSans,
      }}
    >
      {/* Input area — textarea OR voice waveform */}
      <div style={{ position: "relative", minHeight: 96 }}>
        {showVoiceUI ? (
          <VoicePanel
            isRecording={isRecording}
            transcript={text + interimTranscript}
          />
        ) : (
          <>
            <textarea
              ref={taRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              disabled={stage !== "idle"}
              rows={3}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
              }}
              style={{
                width: "100%",
                background: "transparent",
                border: "none",
                outline: "none",
                resize: "none",
                fontFamily: "inherit",
                fontSize: 15,
                lineHeight: 1.55,
                color: "#3B4953",
                minHeight: 84,
              }}
            />
            {/* Cycling placeholder overlay — only when textarea is empty */}
            {text.length === 0 && (
              <div
                key={phIdx}
                aria-hidden
                className="magicus-placeholder-fade"
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  fontSize: 15,
                  lineHeight: 1.55,
                  color: "#90AB8B",
                  pointerEvents: "none",
                }}
              >
                {PLACEHOLDERS[phIdx]}
              </div>
            )}
          </>
        )}
      </div>

      {/* Permission / error rows */}
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
            <strong style={{ fontWeight: 600 }}>
              Microphone access denied.
            </strong>{" "}
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

      {/* Bottom row — modes left, submit right */}
      <div
        className="flex items-center justify-between gap-3"
        style={{
          marginTop: 14,
          paddingTop: 12,
          borderTop: "1px solid #EBF4DD",
        }}
      >
        <div className="flex items-center gap-2">
          <ModePill
            label="Describe"
            icon={<Sparkles size={12} />}
            active={mode === "describe"}
            onClick={() => switchMode("describe")}
          />
          {voiceSupported && (
            <ModePill
              label="Voice"
              icon={<Mic size={12} />}
              active={mode === "voice"}
              onClick={() => switchMode("voice")}
            />
          )}
          <ModePill
            label="Record"
            icon={<Video size={12} />}
            active={false}
            onClick={() => switchMode("record")}
          />
        </div>

        <button
          onClick={submit}
          disabled={submitDisabled}
          className="flex items-center gap-2 transition-opacity"
          style={{
            background: "#3B4953",
            color: "#EBF4DD",
            padding: "10px 18px",
            borderRadius: 999,
            fontSize: 13,
            fontWeight: 500,
            border: "none",
            opacity: submitDisabled ? 0.4 : 1,
            cursor: submitDisabled ? "not-allowed" : "pointer",
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
  );
}

function ModePill({
  label,
  icon,
  active,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 transition-colors"
      style={{
        background: active ? "#3B4953" : "transparent",
        color: active ? "#EBF4DD" : "#547863",
        border: `1px solid ${active ? "#3B4953" : "#EBF4DD"}`,
        padding: "5px 11px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 500,
        cursor: "pointer",
      }}
    >
      {icon}
      {label}
    </button>
  );
}

function VoicePanel({
  isRecording,
  transcript,
}: {
  isRecording: boolean;
  transcript: string;
}) {
  return (
    <div
      className="flex flex-col items-center justify-center"
      style={{ minHeight: 96, gap: 10 }}
    >
      <div className="flex items-end gap-1.5" style={{ height: 32 }}>
        {[0, 1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className="magicus-wave-bar"
            style={{
              animationDelay: `${i * 0.12}s`,
              opacity: isRecording ? 1 : 0.35,
              animationPlayState: isRecording ? "running" : "paused",
            }}
          />
        ))}
      </div>
      <div style={{ fontSize: 13, color: "#547863", fontWeight: 500 }}>
        {isRecording ? "Listening…" : "Voice mode"}
      </div>
      {transcript.trim().length > 0 && (
        <div
          style={{
            fontSize: 13,
            color: "#3B4953",
            lineHeight: 1.5,
            textAlign: "center",
            maxWidth: 580,
            marginTop: 4,
          }}
        >
          {transcript}
        </div>
      )}
    </div>
  );
}

// ─── Below-the-fold sections ───────────────────────────────────────────────
function ButterflySection() {
  return (
    <section
      style={{
        background: "#EBF4DD",
        padding: "80px 32px 96px",
        borderTop: "1px solid #DCE7CB",
      }}
    >
      <div className="max-w-[1100px] mx-auto flex flex-col items-center text-center">
        <h2
          className="text-[28px] md:text-[34px]"
          style={{
            ...dmSerif,
            color: "#3B4953",
            marginBottom: 48,
            letterSpacing: -0.4,
          }}
        >
          Watch a workflow come to life
        </h2>
        <div style={{ transform: "scale(1.1)", transformOrigin: "center" }}>
          <AnimatedButterfly />
        </div>
        <p
          style={{
            ...dmSans,
            fontSize: 13,
            color: "#547863",
            marginTop: 56,
            letterSpacing: 0.1,
          }}
        >
          This is what Magicus generates from a 2-minute recording
        </p>
      </div>
    </section>
  );
}

function PillarsSection() {
  return (
    <section
      style={{
        padding: "80px 32px 32px",
        background: "#F7FAF2",
        backgroundImage:
          "radial-gradient(rgba(144, 171, 139, 0.4) 1.2px, transparent 1.2px)",
        backgroundSize: "28px 28px",
      }}
    >
      <div className="max-w-[1100px] mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-12">
          <Pillar
            icon={<Mic size={20} style={{ color: "#547863" }} />}
            title="Record"
            copy="Show Magicus how you work. Narrate as you go."
          />
          <Pillar
            icon={
              <Zap
                size={20}
                style={{ color: "#547863" }}
                fill="#547863"
                strokeWidth={0}
              />
            }
            title="Analyse"
            copy="See exactly which steps an agent can handle — and which need you."
          />
          <Pillar
            icon={<Link2 size={20} style={{ color: "#547863" }} />}
            title="Automate"
            copy="Get a precise, platform-specific build guide. Deploy in hours."
          />
        </div>
      </div>
    </section>
  );
}

function Pillar({
  icon,
  title,
  copy,
}: {
  icon: React.ReactNode;
  title: string;
  copy: string;
}) {
  return (
    <div className="flex flex-col items-start">
      <div
        className="flex items-center justify-center"
        style={{
          width: 40,
          height: 40,
          borderRadius: 10,
          background: "#EBF4DD",
          marginBottom: 16,
        }}
      >
        {icon}
      </div>
      <div
        style={{
          ...dmSerif,
          fontSize: 22,
          color: "#3B4953",
          marginBottom: 8,
          letterSpacing: -0.2,
        }}
      >
        {title}
      </div>
      <p
        style={{
          fontSize: 15,
          color: "#547863",
          lineHeight: 1.55,
          maxWidth: 280,
        }}
      >
        {copy}
      </p>
    </div>
  );
}

function SocialProof() {
  return (
    <section
      style={{
        padding: "32px 32px 64px",
        background: "#F7FAF2",
        backgroundImage:
          "radial-gradient(rgba(144, 171, 139, 0.4) 1.2px, transparent 1.2px)",
        backgroundSize: "28px 28px",
        textAlign: "center",
      }}
    >
      <div
        style={{
          ...dmSans,
          fontSize: 14,
          color: "#90AB8B",
          letterSpacing: 0.2,
        }}
      >
        Join thousands of AI-pilled leaders automating their workflows
      </div>
    </section>
  );
}

// ─── Public component ─────────────────────────────────────────────────────
export function LandingHero({
  onMap,
  onBrowseExamples,
  onRecord,
}: {
  onMap: (description: string) => Promise<void>;
  onBrowseExamples: () => void;
  onRecord: () => void;
}) {
  return (
    <div className="min-h-screen w-full flex flex-col" style={{ ...dmSans }}>
      <div className="flex flex-col" style={{ minHeight: "100vh" }}>
        <HeroHeader />
        <HeroSection
          onMap={onMap}
          onBrowseExamples={onBrowseExamples}
          onRecord={onRecord}
        />
      </div>
      <ButterflySection />
      <PillarsSection />
      <SocialProof />
    </div>
  );
}
