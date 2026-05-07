"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
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
  Lock,
  Zap,
} from "lucide-react";
import { useAuth, useRequireAuth } from "@/lib/auth-context";
import { AnimatedButterfly } from "./animated-butterfly";
import { LogoMark } from "./logo";
import { ClarificationStep } from "./clarification-step";
import {
  fetchClarifyQuestions,
  combineDescriptionWithClarifications,
  type ClarifyAnswer,
} from "@/lib/clarify";

// ─── Palette ──────────────────────────────────────────────────────────────
// Kept inline rather than in a tokens file because the colours here are
// load-bearing for the hero design and reading them in context is easier
// than chasing them through a theme. Tokens match the brand-colours
// section of the logo spec — see app/components/logo.tsx BRAND_COLORS.
const HERO_BG = "#2A3330"; // Ink Deep — hero canvas
const HERO_INK = "#FAFAF5"; // Cream — primary type on dark
const HERO_INK_DIM = "#A8BDB8"; // muted teal — body type on dark
const EYEBROW = "#90AB8B"; // Sage Mid — eyebrow + secondary muted
const CORAL = "#E66B4D"; // Coral — accent: italic "you", Map it, browse CTA

const dmSerifItalic = {
  fontFamily: "var(--font-dm-serif), serif",
  fontStyle: "italic" as const,
};
const dmSerif = { fontFamily: "var(--font-dm-serif), serif" };
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
// Sits on the dark hero. Logo in coral, right-side CTA is a ghost-on-dark
// pill — its label flips between "Sign in" and "Go to your canvas" based
// on auth state so signed-in users who arrive at the landing (via the
// `?welcome=1` escape hatch) have a way back to the workspace.
function HeroHeader({ onGoToCanvas }: { onGoToCanvas?: () => void }) {
  const { user, openGate } = useAuth();
  const showCanvasCTA = !!user && !!onGoToCanvas;
  return (
    <header
      className="flex items-center justify-between"
      style={{ padding: "24px 32px", position: "relative", zIndex: 2 }}
    >
      <div className="flex items-center gap-2.5">
        <LogoMark variant="coral" size={32} onDark />
        <span
          style={{
            ...dmSerifItalic,
            fontSize: 24,
            color: HERO_INK,
            letterSpacing: -0.2,
          }}
        >
          magicus
        </span>
      </div>
      <button
        onClick={() => (showCanvasCTA ? onGoToCanvas!() : openGate())}
        className="hover:bg-white/5 transition-colors"
        style={{
          background: "transparent",
          color: HERO_INK,
          padding: "10px 18px",
          borderRadius: 999,
          fontSize: 14,
          fontWeight: 500,
          border: "1px solid rgba(245, 240, 232, 0.25)",
          cursor: "pointer",
        }}
      >
        {showCanvasCTA ? "Go to your canvas →" : "Sign in"}
      </button>
    </header>
  );
}

// Atmospheric butterfly silhouette behind the headline. Very low opacity
// so it reads as texture, not as a literal mark — the eye picks up the
// shape only when it's not focused on the type. Both halves visible
// (centred more than offscreen-right) so the butterfly silhouette is
// recognisable rather than a single half-disc on the edge.
function HeroBackgroundButterfly() {
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        top: "50%",
        right: "8%",
        transform: "translateY(-50%)",
        width: "min(640px, 60vw)",
        height: "min(640px, 60vw)",
        opacity: 0.06,
        pointerEvents: "none",
        zIndex: 0,
      }}
    >
      <svg viewBox="0 0 24 24" width="100%" height="100%">
        <ellipse cx="8.5" cy="11" rx="5" ry="7.2" fill="#FFFFFF" />
        <ellipse cx="15.5" cy="11" rx="5" ry="7.2" fill="#FFFFFF" />
        <line
          x1="12"
          y1="3.2"
          x2="12"
          y2="20.8"
          stroke="#FFFFFF"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}

// ─── Hero (eyebrow + headline + subhead + prompt + browse) ────────────────
// Dark slate canvas with a faint dot grid for texture and a low-opacity
// butterfly silhouette behind the headline. Content sits in the middle on
// a stacking context above the silhouette.
function HeroSection({
  onMap,
  onBrowseLibrary,
  onRecord,
}: {
  onMap: (description: string) => Promise<void>;
  onBrowseLibrary: () => void;
  onRecord: () => void;
}) {
  return (
    <section
      className="relative flex-1 flex items-center justify-center"
      style={{
        padding: "32px 24px 96px",
        background: `
          radial-gradient(rgba(255, 255, 255, 0.06) 1px, transparent 1px),
          ${HERO_BG}
        `,
        backgroundSize: "28px 28px, auto",
        overflow: "hidden",
      }}
    >
      <HeroBackgroundButterfly />

      <div
        className="w-full max-w-[860px] mx-auto flex flex-col items-center text-center"
        style={{ position: "relative", zIndex: 1 }}
      >
        <div
          style={{
            color: EYEBROW,
            fontSize: 12,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            fontWeight: 500,
            marginBottom: 28,
          }}
        >
          Workflow intelligence for the AI era
        </div>

        <h1
          className="text-[44px] md:text-[64px] lg:text-[72px]"
          style={{
            ...dmSerif,
            fontWeight: 400,
            color: HERO_INK,
            lineHeight: 1.05,
            letterSpacing: -1,
            marginBottom: 24,
            maxWidth: 880,
          }}
        >
          The way{" "}
          <em
            style={{
              fontStyle: "italic",
              color: CORAL,
              fontFamily: "var(--font-dm-serif), serif",
            }}
          >
            you
          </em>{" "}
          actually work.
        </h1>

        <p
          className="text-[16px] md:text-[18px]"
          style={{
            color: HERO_INK_DIM,
            lineHeight: 1.55,
            maxWidth: 560,
            marginBottom: 40,
          }}
        >
          Talk through any process in plain language. Magicus maps it, scores
          what&apos;s automatable, and tells you exactly where AI agents
          should plug in.
        </p>

        <PromptBox onMap={onMap} onRecord={onRecord} />

        <button
          onClick={onBrowseLibrary}
          className="hover:underline flex items-center gap-1 mt-6"
          style={{
            background: "transparent",
            color: CORAL,
            fontSize: 13,
            fontWeight: 500,
            border: "none",
            padding: "8px 12px",
            cursor: "pointer",
          }}
        >
          Or browse the workflow library
          <ArrowRight size={13} />
        </button>
      </div>
    </section>
  );
}

// ─── Prompt box ────────────────────────────────────────────────────────────
type Mode = "describe" | "voice" | "record";
// Submission stages now include `clarifying`: the brief moment between
// the user submitting their description and the workflow generation
// kicking off, during which we fetch up to 3 follow-up questions and
// (if any are returned) collect answers in place inside the same card.
type Stage = "idle" | "fetchingQuestions" | "clarifying" | "generating";

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
  // Used to drive the padlock on Voice / Record so the auth gate isn't
  // a surprise when an unauthed user clicks.
  const { user } = useAuth();

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

  // Clarification state. We hold the question list separately from the
  // stage so we can keep showing the questions if generation fails after
  // the user has already submitted them.
  const [clarifyQuestions, setClarifyQuestions] = useState<string[]>([]);

  // Fire-and-await the workflow generation with whatever description we
  // ended up with (raw or augmented with clarifications). Centralised so
  // both the "skip" path and the "answered" path share error handling.
  const runGeneration = async (finalDescription: string) => {
    setStage("generating");
    try {
      await onMap(finalDescription);
    } catch {
      setSubmitError(
        "Couldn't generate a workflow — check your connection and try again.",
      );
      setStage("idle");
      setClarifyQuestions([]);
    }
  };

  const doSubmit = async () => {
    if (stage !== "idle" || text.trim().length === 0) return;
    if (isRecording) stopRecording();
    setSubmitError(null);

    // Step 1: ask the LLM for follow-up questions. fetchClarifyQuestions
    // never throws — it returns [] on any failure, so a flaky clarify
    // round-trip silently degrades to direct generation.
    setStage("fetchingQuestions");
    const questions = await fetchClarifyQuestions(text);

    if (questions.length === 0) {
      // Nothing to clarify (or call failed) — straight to generation.
      await runGeneration(text);
      return;
    }

    // Step 2: hand off to the in-card clarification UI. Generation runs
    // when the user submits or skips.
    setClarifyQuestions(questions);
    setStage("clarifying");
  };

  const handleClarifySubmit = async (qa: ClarifyAnswer[]) => {
    const combined = combineDescriptionWithClarifications(text, qa);
    await runGeneration(combined);
  };

  const handleClarifySkip = async () => {
    // Same generation path as before, with no clarifications appended.
    await runGeneration(text);
  };

  const submit = () => {
    if (text.trim().length === 0) return;
    // For unauthed users the auth gate redirects through Google OAuth,
    // which unloads this page — the in-memory pendingAction closure is
    // gone by the time we come back. Stash the text in sessionStorage so
    // the post-OAuth bootstrap in app/page.tsx can replay generation
    // automatically. Authed users skip this branch and take the normal
    // closure path.
    if (!user) {
      try {
        sessionStorage.setItem("magicus_pending_input", text);
      } catch { /* storage disabled — user will just see empty canvas */ }
    }
    guard(() => {
      void doSubmit();
    });
  };

  const fetchingQuestions = stage === "fetchingQuestions";
  const clarifying = stage === "clarifying";
  const generating = stage === "generating";
  const submitDisabled =
    text.trim().length === 0 || generating || fetchingQuestions || clarifying;
  const showVoiceUI = mode === "voice" && !clarifying;

  return (
    <div
      className="w-full"
      style={{
        maxWidth: 760,
        background: "#FFFFFF",
        // No border on dark — the shadow does all the lifting.
        borderRadius: 16,
        padding: "20px 24px",
        boxShadow: "0 8px 48px rgba(0, 0, 0, 0.3)",
        // Reset text-align: the parent hero is `text-center`, which the
        // textarea ignores but the absolutely-positioned placeholder
        // overlay otherwise inherits — making short placeholders look
        // centred and long ones (which wrap) look indented.
        textAlign: "left",
        ...dmSans,
      }}
    >
      {clarifying ? (
        <ClarificationStep
          questions={clarifyQuestions}
          onSubmit={(qa) => { void handleClarifySubmit(qa); }}
          onSkip={() => { void handleClarifySkip(); }}
          busy={generating}
        />
      ) : (
        <>
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
          // Neutral grey divider — the previous sage tone read oddly on
          // a white card sitting on the dark hero.
          borderTop: "1px solid #ECECEC",
        }}
      >
        <div className="flex items-center gap-2">
          <ModePill
            label="Describe"
            icon={<Sparkles size={12} />}
            active={mode === "describe"}
            onClick={() => switchMode("describe")}
            activeIconColor={CORAL}
          />
          {voiceSupported && (
            <ModePill
              label="Voice"
              icon={<Mic size={12} />}
              active={mode === "voice"}
              onClick={() => switchMode("voice")}
              locked={!user}
              lockedTitle="Sign in to use voice input"
            />
          )}
          <ModePill
            label="Record"
            icon={<Video size={12} />}
            active={false}
            onClick={() => switchMode("record")}
            locked={!user}
            lockedTitle="Sign in to record your screen"
          />
        </div>

        <button
          onClick={submit}
          disabled={submitDisabled}
          className="flex items-center gap-2 transition-colors"
          style={{
            // Disabled state: lighter coral that still looks intentional
            // (the 0.4 opacity it used to be made it read as broken).
            background: submitDisabled ? "#F4A294" : CORAL,
            color: "#FFFFFF",
            padding: "10px 20px",
            borderRadius: 999,
            fontSize: 14,
            fontWeight: 500,
            border: "none",
            cursor: submitDisabled ? "not-allowed" : "pointer",
          }}
        >
          {fetchingQuestions || generating ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              {generating ? "Mapping" : ""}
            </>
          ) : (
            <>
              <Send size={14} />
              Map it
            </>
          )}
        </button>
      </div>
        </>
      )}
    </div>
  );
}

function ModePill({
  label,
  icon,
  active,
  onClick,
  activeIconColor,
  locked,
  lockedTitle,
}: {
  label: string;
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
  // When set, the icon is wrapped in a coloured span only while active.
  // Lets the Describe pill show a coral sparkle on the dark active state.
  activeIconColor?: string;
  // Auth-gated mode for unauthed users: shows a small padlock so the
  // sign-in modal isn't a surprise on click.
  locked?: boolean;
  lockedTitle?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={locked ? lockedTitle : undefined}
      className="flex items-center gap-1.5 transition-colors"
      style={{
        background: active ? HERO_BG : "transparent",
        color: active ? "#FFFFFF" : "#6B8A8F",
        border: `1px solid ${active ? HERO_BG : "#DCE3E5"}`,
        padding: "6px 12px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 500,
        cursor: "pointer",
      }}
    >
      {active && activeIconColor ? (
        <span style={{ color: activeIconColor, display: "inline-flex" }}>{icon}</span>
      ) : (
        icon
      )}
      {label}
      {locked && (
        <Lock
          size={10}
          style={{ color: "#90A6AC", marginLeft: 2 }}
          aria-label="Sign in required"
        />
      )}
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
        // No borderTop — the gradient transition above resolves into
        // this section's background; an extra rule reads as a seam.
      }}
    >
      <div className="max-w-[1100px] mx-auto flex flex-col items-center text-center">
        <h2
          className="text-[28px] md:text-[34px]"
          style={{
            ...dmSerifItalic,
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
          ...dmSerifItalic,
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

// Landing footer — small wordmark line, copyright, and the legal links
// Google's OAuth verification expects to see prominently linked from the
// app's home page (privacy + terms). Sits on the same sage backdrop as
// the pillars section so the page closes cleanly.
function LandingFooter() {
  const year = new Date().getFullYear();
  return (
    <footer
      style={{
        background: "#F7FAF2",
        padding: "32px 32px 56px",
        borderTop: "1px solid #EBF4DD",
        ...dmSans,
      }}
    >
      <div
        className="max-w-[1100px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-3"
        style={{ fontSize: 13, color: "#90AB8B" }}
      >
        <div className="flex items-center gap-2">
          <LogoMark variant="sage" size={18} />
          <span style={{ ...dmSerifItalic, fontSize: 16, color: "#547863" }}>
            magicus
          </span>
          <span style={{ marginLeft: 8 }}>© {year}</span>
        </div>
        <div className="flex items-center gap-5">
          <Link href="/privacy" style={{ color: "#547863", textDecoration: "none" }} className="hover:underline">
            Privacy
          </Link>
          <Link href="/terms" style={{ color: "#547863", textDecoration: "none" }} className="hover:underline">
            Terms
          </Link>
          <a
            href="mailto:team@netlearn.io"
            style={{ color: "#547863", textDecoration: "none" }}
            className="hover:underline"
          >
            Contact
          </a>
        </div>
      </div>
    </footer>
  );
}

// 180px gradient that bridges the dark hero to the sage section below
// it. Sits in normal flow so it pushes content rather than overlapping;
// the bottom colour matches ButterflySection's background. We took the
// border-top off ButterflySection to avoid a visible seam where the
// gradient resolves.
function HeroToSageTransition() {
  return (
    <div
      aria-hidden
      style={{
        height: 180,
        background: `linear-gradient(to bottom, ${HERO_BG} 0%, #EBF4DD 100%)`,
      }}
    />
  );
}

// ─── Public component ─────────────────────────────────────────────────────
export function LandingHero({
  onMap,
  onBrowseLibrary,
  onRecord,
  onGoToCanvas,
}: {
  onMap: (description: string) => Promise<void>;
  onBrowseLibrary: () => void;
  onRecord: () => void;
  // Optional: when set, the header CTA flips to "Go to your canvas →"
  // for signed-in users who reached the landing via the escape hatch.
  onGoToCanvas?: () => void;
}) {
  return (
    <div className="min-h-screen w-full flex flex-col" style={{ ...dmSans }}>
      <div className="flex flex-col" style={{ minHeight: "100vh", background: HERO_BG }}>
        <HeroHeader onGoToCanvas={onGoToCanvas} />
        <HeroSection
          onMap={onMap}
          onBrowseLibrary={onBrowseLibrary}
          onRecord={onRecord}
        />
      </div>
      <HeroToSageTransition />
      <ButterflySection />
      <PillarsSection />
      {/* Social proof strip removed — "Join thousands of AI-pilled
          leaders…" was unsubstantiated and the in-group slang risked
          alienating more conservative visitors. Will return when we
          have real testimonials with names. */}
      <LandingFooter />
    </div>
  );
}
