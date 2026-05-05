"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Pause,
  Play,
  Square,
  AlertCircle,
  ArrowRight,
  Sparkles,
  X,
} from "lucide-react";
import { upload } from "@vercel/blob/client";
import { AnimatedButterfly } from "./animated-butterfly";

const dmSerif = { fontFamily: "var(--font-dm-serif), serif", fontStyle: "italic" as const };
const dmSans = { fontFamily: "var(--font-dm-sans), sans-serif" };

// ─── Public types ──────────────────────────────────────────────────────────

export type RecordedStep = {
  n: number;
  text: string;
  note?: string;
  owner?: string;
  timestamp?: number;
  screenshot?: string;
};

export type RecordedWorkflow = {
  id: string;
  theme: "sales" | "marketing" | "operations" | "finance";
  name: string;
  trigger:
    | { type: "schedule" | "event" | "manual" | "chained"; description?: string }
    | null;
  why: string;
  inputs: { name: string; source: string }[];
  steps: RecordedStep[];
  outputs: { name: string; source: string }[];
  tools: string[];
  automationScore: number;
  automationRationale: string;
};

// ─── Speech recognition (locally re-declared) ──────────────────────────────
type SpeechRecognitionResultLike = { isFinal: boolean; 0: { transcript: string } };
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

// ─── useRecorder: owns streams, MediaRecorder, transcript, timer ──────────
type RecorderState = "idle" | "starting" | "recording" | "paused" | "stopping" | "denied";

type RecorderResult = {
  blob: Blob;
  durationSeconds: number;
  transcript: string;
  mimeType: string;
};

function useRecorder() {
  const [state, setState] = useState<RecorderState>("idle");
  const [transcript, setTranscript] = useState("");
  const [interim, setInterim] = useState("");
  const [elapsedSec, setElapsedSec] = useState(0);
  const [lastSpeechAt, setLastSpeechAt] = useState<number>(Date.now());

  const screenStreamRef = useRef<MediaStream | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const combinedStreamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const accumulatedMsRef = useRef<number>(0); // accounts for time spent before pause
  // resolveStop is fulfilled when MediaRecorder fires `stop` and we've
  // assembled the final Blob.
  const resolveStopRef = useRef<((r: RecorderResult) => void) | null>(null);

  const tickTimer = useCallback(() => {
    if (startedAtRef.current === null) return;
    const ms = accumulatedMsRef.current + (Date.now() - startedAtRef.current);
    setElapsedSec(Math.floor(ms / 1000));
  }, []);

  const beginTimer = useCallback(() => {
    startedAtRef.current = Date.now();
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(tickTimer, 250);
  }, [tickTimer]);

  const pauseTimer = useCallback(() => {
    if (startedAtRef.current !== null) {
      accumulatedMsRef.current += Date.now() - startedAtRef.current;
      startedAtRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const cleanup = useCallback(() => {
    try { recorderRef.current?.stop(); } catch {}
    recorderRef.current = null;

    try { recognitionRef.current?.abort(); } catch {}
    recognitionRef.current = null;

    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    micStreamRef.current?.getTracks().forEach((t) => t.stop());
    combinedStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenStreamRef.current = null;
    micStreamRef.current = null;
    combinedStreamRef.current = null;

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Cleanup on unmount.
  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  const start = useCallback(async (): Promise<{ ok: true } | { ok: false; reason: "denied" | "unsupported" }> => {
    setState("starting");

    // Capture screen (and any system audio the user opts to share — Gemini
    // can use this too, but it's optional). Mic is captured separately so
    // SpeechRecognition has a clean source.
    let screenStream: MediaStream;
    try {
      screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 15 },
        audio: true,
      });
    } catch {
      setState("denied");
      return { ok: false, reason: "denied" };
    }
    screenStreamRef.current = screenStream;

    // If the user stops sharing from the browser's native UI, treat that as
    // a Stop event. We still surface their captured-so-far recording.
    screenStream.getVideoTracks()[0]?.addEventListener("ended", () => {
      void stopInternal();
    });

    // Mic. Failure here is non-fatal — they can still record without
    // narration, just less rich data for Gemini.
    let micStream: MediaStream | null = null;
    try {
      micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      micStream = null;
    }
    micStreamRef.current = micStream;

    // Combine: screen video + mic audio (preferred) or screen audio.
    const combined = new MediaStream();
    screenStream.getVideoTracks().forEach((t) => combined.addTrack(t));
    if (micStream) {
      micStream.getAudioTracks().forEach((t) => combined.addTrack(t));
    } else {
      screenStream.getAudioTracks().forEach((t) => combined.addTrack(t));
    }
    combinedStreamRef.current = combined;

    // Pick the best supported mimeType. webm/vp8 has wide support; gemini
    // accepts video/webm.
    const candidates = [
      "video/webm;codecs=vp9,opus",
      "video/webm;codecs=vp8,opus",
      "video/webm",
      "video/mp4",
    ];
    const mimeType = candidates.find((m) =>
      typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m)
    ) ?? "";

    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(combined, {
        mimeType: mimeType || undefined,
        videoBitsPerSecond: 600_000,
        audioBitsPerSecond: 64_000,
      });
    } catch {
      cleanup();
      setState("idle");
      return { ok: false, reason: "unsupported" };
    }
    recorderRef.current = recorder;
    chunksRef.current = [];

    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      const finalMime = recorder.mimeType || mimeType || "video/webm";
      const blob = new Blob(chunksRef.current, { type: finalMime });
      const finalElapsed =
        accumulatedMsRef.current +
        (startedAtRef.current !== null ? Date.now() - startedAtRef.current : 0);
      const result: RecorderResult = {
        blob,
        durationSeconds: Math.max(0, Math.floor(finalElapsed / 1000)),
        transcript: "",
        mimeType: finalMime,
      };
      // Resolve will read the latest transcript at call time (closure).
      resolveStopRef.current?.(result);
      resolveStopRef.current = null;
    };

    // Speech recognition. Web Speech API is Chrome/Edge only — gracefully
    // skip on others; we'll just have a less rich workflow.
    const Ctor = getSpeechRecognition();
    if (Ctor) {
      const rec = new Ctor();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = "en-US";

      let baseTranscript = "";
      rec.onresult = (e) => {
        let finalChunk = "";
        let interimChunk = "";
        for (let i = 0; i < e.results.length; i++) {
          const r = e.results[i];
          if (r.isFinal) finalChunk += r[0].transcript;
          else interimChunk += r[0].transcript;
        }
        // Use a manual accumulator so pause/resume doesn't reset state.
        baseTranscript = finalChunk;
        setTranscript(finalChunk);
        setInterim(interimChunk);
        if (finalChunk.length > 0 || interimChunk.length > 0) {
          setLastSpeechAt(Date.now());
        }
      };
      rec.onend = () => { /* may auto-end; we only re-start on resume */ };
      rec.onerror = () => { /* swallow — recording continues regardless */ };
      recognitionRef.current = rec;
      try { rec.start(); } catch { /* not-allowed; silent fallback */ }
      // Touch baseTranscript to silence unused warning (the closure reads it
      // each result event).
      void baseTranscript;
    }

    accumulatedMsRef.current = 0;
    startedAtRef.current = null;
    setElapsedSec(0);
    setTranscript("");
    setInterim("");
    setLastSpeechAt(Date.now());
    recorder.start(1000); // emit chunks every 1s
    beginTimer();
    setState("recording");
    return { ok: true };
  }, [beginTimer, cleanup]);

  const pause = useCallback(() => {
    const r = recorderRef.current;
    if (r && r.state === "recording") r.pause();
    try { recognitionRef.current?.stop(); } catch {}
    pauseTimer();
    setState("paused");
  }, [pauseTimer]);

  const resume = useCallback(() => {
    const r = recorderRef.current;
    if (r && r.state === "paused") r.resume();
    try { recognitionRef.current?.start(); } catch {}
    beginTimer();
    setState("recording");
  }, [beginTimer]);

  // Actual stop — resolves once MediaRecorder.onstop fires.
  const stopInternal = useCallback(async (): Promise<RecorderResult> => {
    setState("stopping");
    pauseTimer();
    try { recognitionRef.current?.stop(); } catch {}

    const r = recorderRef.current;
    if (!r) {
      // No recorder — return an empty result so callers can still navigate.
      return {
        blob: new Blob([], { type: "video/webm" }),
        durationSeconds: elapsedSec,
        transcript,
        mimeType: "video/webm",
      };
    }
    return new Promise<RecorderResult>((resolve) => {
      resolveStopRef.current = (result) => {
        // Inject the latest transcript before handing back.
        result.transcript = (transcript + " " + interim).trim();
        resolve(result);
      };
      try { r.stop(); } catch {
        resolve({
          blob: new Blob(chunksRef.current, { type: r.mimeType || "video/webm" }),
          durationSeconds: elapsedSec,
          transcript: (transcript + " " + interim).trim(),
          mimeType: r.mimeType || "video/webm",
        });
      }
    });
  }, [pauseTimer, elapsedSec, transcript, interim]);

  return {
    state,
    transcript,
    interim,
    elapsedSec,
    lastSpeechAt,
    start,
    pause,
    resume,
    stop: stopInternal,
    cleanup,
  };
}

// ─── Helpers ───────────────────────────────────────────────────────────────
function formatTime(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// Extract a frame from a recorded video blob at a given timestamp (seconds).
// Returns a data URL or null if extraction fails.
export async function extractFrame(
  blob: Blob,
  timestampSec: number
): Promise<string | null> {
  if (typeof window === "undefined") return null;
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.src = url;
    let resolved = false;
    const finish = (result: string | null) => {
      if (resolved) return;
      resolved = true;
      URL.revokeObjectURL(url);
      resolve(result);
    };
    video.addEventListener("loadedmetadata", () => {
      const t = Math.min(Math.max(0.1, timestampSec), Math.max(0.1, video.duration - 0.1));
      try { video.currentTime = t; } catch { finish(null); }
    });
    video.addEventListener("seeked", () => {
      const w = video.videoWidth || 640;
      const h = video.videoHeight || 360;
      const canvas = document.createElement("canvas");
      // Cap thumbnail at 640px wide to keep dataURL size sane.
      const scale = Math.min(1, 640 / w);
      canvas.width = Math.round(w * scale);
      canvas.height = Math.round(h * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) return finish(null);
      try {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        finish(canvas.toDataURL("image/jpeg", 0.8));
      } catch {
        finish(null);
      }
    });
    video.addEventListener("error", () => finish(null));
    setTimeout(() => finish(null), 5000);
  });
}

// ─── Screens ───────────────────────────────────────────────────────────────

type Stage = "prep" | "recording" | "review" | "processing" | "error";

function PrepScreen({
  onStart,
  onCancel,
  errorMsg,
}: {
  onStart: () => void;
  onCancel: () => void;
  errorMsg: string | null;
}) {
  return (
    <div
      className="min-h-screen w-full flex flex-col"
      style={{
        ...dmSans,
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
      <header
        className="flex items-center justify-between"
        style={{ padding: "24px 32px" }}
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
          <div style={{ ...dmSerif, fontSize: 22, color: "#3B4953", letterSpacing: -0.2 }}>
            magicus
          </div>
        </div>
        {/* Explicit close so users who change their mind don't have to read
            'Describe instead' as 'cancel'. */}
        <button
          onClick={onCancel}
          className="hover:bg-[#EBF4DD] rounded-md p-2 transition-colors"
          style={{ color: "#547863" }}
          aria-label="Close"
          title="Back to canvas"
        >
          <X size={18} />
        </button>
      </header>

      <section className="flex-1 flex items-center justify-center" style={{ padding: "32px 24px 80px" }}>
        <div className="w-full max-w-[840px] mx-auto flex flex-col items-center text-center">
          <div
            style={{
              color: "#547863",
              fontSize: 12,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              fontWeight: 500,
              marginBottom: 18,
            }}
          >
            Before you start
          </div>
          <h1
            className="text-[36px] md:text-[48px]"
            style={{
              ...dmSerif,
              color: "#3B4953",
              lineHeight: 1.05,
              letterSpacing: -0.6,
              marginBottom: 16,
            }}
          >
            Show us how you work.
          </h1>
          <p
            className="text-[15px] md:text-[16px]"
            style={{
              color: "#547863",
              lineHeight: 1.55,
              maxWidth: 480,
              marginBottom: 40,
            }}
          >
            Navigate to the tool or process you want to map. Narrate out loud as
            you go — the more you say, the richer your workflow will be. Click
            Stop when you&apos;re done.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full" style={{ marginBottom: 40 }}>
            <InstructionCard n={1} title="Open your tool" body="Switch to the app or browser tab you'll be working in" />
            <InstructionCard n={2} title="Narrate as you go" body="Speak out loud. Describe what you're doing and why" />
            <InstructionCard n={3} title="Click Stop when done" body="Magicus will process the recording and map your workflow" />
          </div>

          <div className="flex flex-col items-center gap-3">
            <button
              onClick={onStart}
              className="hover:opacity-90 transition-opacity flex items-center gap-2"
              style={{
                background: "#3B4953",
                color: "#EBF4DD",
                padding: "14px 28px",
                borderRadius: 999,
                fontSize: 15,
                fontWeight: 500,
                border: "none",
                cursor: "pointer",
              }}
            >
              Start recording
              <ArrowRight size={16} />
            </button>
            <button
              onClick={onCancel}
              className="hover:underline"
              style={{
                background: "transparent",
                color: "#547863",
                fontSize: 13,
                fontWeight: 500,
                border: "none",
                padding: "8px 12px",
                cursor: "pointer",
              }}
            >
              Describe instead
            </button>
          </div>

          {errorMsg && (
            <div
              role="alert"
              className="flex items-start gap-2"
              style={{
                marginTop: 24,
                padding: "10px 14px",
                background: "#FDECEC",
                border: "1px solid #E5A8A8",
                borderRadius: 8,
                fontSize: 13,
                color: "#8B2A2A",
                lineHeight: 1.45,
                maxWidth: 480,
              }}
            >
              <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 2 }} />
              <span>
                {errorMsg}{" "}
                <button
                  onClick={onCancel}
                  className="hover:underline"
                  style={{
                    background: "transparent",
                    color: "#8B2A2A",
                    fontWeight: 600,
                    border: "none",
                    padding: 0,
                    cursor: "pointer",
                  }}
                >
                  Describe instead
                </button>
              </span>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function InstructionCard({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <div
      style={{
        background: "#FFFFFF",
        border: "1px solid #EBF4DD",
        borderRadius: 12,
        padding: "18px 18px 20px",
        boxShadow: "0 4px 16px rgba(59, 73, 83, 0.06)",
        textAlign: "left",
      }}
    >
      <div
        style={{
          width: 26,
          height: 26,
          borderRadius: 999,
          background: "#EBF4DD",
          color: "#547863",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 13,
          fontWeight: 600,
          marginBottom: 12,
        }}
      >
        {n}
      </div>
      <div style={{ fontSize: 14, fontWeight: 600, color: "#3B4953", marginBottom: 4 }}>
        {title}
      </div>
      <div style={{ fontSize: 13, color: "#547863", lineHeight: 1.5 }}>{body}</div>
    </div>
  );
}

function RecordingScreen({
  state,
  elapsedSec,
  transcript,
  interim,
  showNarrationNudge,
  onPause,
  onResume,
  onStop,
}: {
  state: RecorderState;
  elapsedSec: number;
  transcript: string;
  interim: string;
  showNarrationNudge: boolean;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
}) {
  const transcriptRef = useRef<HTMLDivElement>(null);
  // Auto-scroll the transcript so the latest words stay in view.
  useEffect(() => {
    transcriptRef.current?.scrollTo({
      top: transcriptRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [transcript, interim]);

  const isPaused = state === "paused";
  const fullTranscript = (transcript + (interim ? " " + interim : "")).trim();

  return (
    <div
      className="min-h-screen w-full flex flex-col items-center justify-center"
      style={{
        ...dmSans,
        background: "#1C2420",
        color: "#EBF4DD",
        position: "relative",
        padding: "48px 32px",
      }}
    >
      <div className="flex flex-col items-center" style={{ gap: 18 }}>
        <div className="flex items-center gap-3">
          <span
            style={{
              width: 12,
              height: 12,
              borderRadius: 999,
              background: isPaused ? "#90AB8B" : "#E5675A",
              boxShadow: isPaused ? "none" : "0 0 0 0 rgba(229,103,90,0.5)",
              animation: isPaused ? "none" : "magicus-rec-pulse 1.4s ease-in-out infinite",
            }}
          />
          <span
            style={{
              fontSize: 13,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: isPaused ? "#90AB8B" : "#EBF4DD",
              fontWeight: 500,
            }}
          >
            {isPaused ? "Paused" : "Recording"}
          </span>
        </div>
        <div
          style={{
            ...dmSerif,
            fontSize: 64,
            color: "#EBF4DD",
            letterSpacing: -1,
            lineHeight: 1,
          }}
        >
          {formatTime(elapsedSec)}
        </div>
        <div style={{ fontSize: 14, color: "#90AB8B", marginTop: -4 }}>
          You can switch to another tab — recording continues
        </div>
      </div>

      {/* Live transcript */}
      <div
        ref={transcriptRef}
        style={{
          marginTop: 40,
          maxWidth: 640,
          width: "100%",
          minHeight: 80,
          maxHeight: 6 * 1.6 * 16, // 6 lines @ 16px line-height
          overflowY: "auto",
          fontSize: 16,
          color: "#90AB8B",
          lineHeight: 1.6,
          textAlign: "center",
          padding: "0 16px",
        }}
      >
        {fullTranscript || (
          <span style={{ fontStyle: "italic", opacity: 0.6 }}>
            Your narration will appear here…
          </span>
        )}
      </div>

      {showNarrationNudge && (
        <div
          style={{
            marginTop: 18,
            fontSize: 13,
            color: "#90AB8B",
            background: "rgba(235, 244, 221, 0.06)",
            border: "1px solid rgba(235, 244, 221, 0.12)",
            padding: "8px 14px",
            borderRadius: 999,
            maxWidth: 540,
            textAlign: "center",
          }}
        >
          💬 Try narrating what you&apos;re doing — it helps Magicus build a richer workflow
        </div>
      )}

      {/* Floating toolbar */}
      <div
        className="flex items-center gap-3"
        style={{
          position: "fixed",
          bottom: 24,
          left: "50%",
          transform: "translateX(-50%)",
          background: "#1C2420",
          border: "1px solid rgba(235, 244, 221, 0.14)",
          padding: "8px 12px 8px 16px",
          borderRadius: 999,
          boxShadow: "0 8px 32px rgba(0, 0, 0, 0.45)",
          color: "#EBF4DD",
          ...dmSans,
          zIndex: 50,
        }}
      >
        <span style={{ fontSize: 13, fontVariantNumeric: "tabular-nums", letterSpacing: 0.4 }}>
          {formatTime(elapsedSec)}
        </span>
        <button
          onClick={isPaused ? onResume : onPause}
          aria-label={isPaused ? "Resume" : "Pause"}
          className="flex items-center gap-1.5 hover:opacity-90 transition-opacity"
          style={{
            background: "rgba(235, 244, 221, 0.14)",
            color: "#EBF4DD",
            padding: "7px 14px",
            borderRadius: 999,
            fontSize: 12,
            fontWeight: 500,
            border: "none",
            cursor: "pointer",
          }}
        >
          {isPaused ? <Play size={12} /> : <Pause size={12} />}
          {isPaused ? "Resume" : "Pause"}
        </button>
        <button
          onClick={onStop}
          aria-label="Stop"
          className="flex items-center gap-1.5 hover:opacity-90 transition-opacity"
          style={{
            background: "#E5675A",
            color: "#FFFFFF",
            padding: "7px 14px",
            borderRadius: 999,
            fontSize: 12,
            fontWeight: 500,
            border: "none",
            cursor: "pointer",
          }}
        >
          <Square size={11} fill="#FFFFFF" />
          Stop
        </button>
      </div>
    </div>
  );
}

function ReviewScreen({
  thumbnail,
  durationSeconds,
  transcript,
  onMap,
  onReRecord,
  onCancel,
}: {
  thumbnail: string | null;
  durationSeconds: number;
  transcript: string;
  onMap: () => void;
  onReRecord: () => void;
  onCancel: () => void;
}) {
  const wordCount = transcript.trim().split(/\s+/).filter(Boolean).length;
  const noNarration = wordCount < 4;
  const excerpt = transcript.slice(0, 100).trim();

  const minutes = Math.floor(durationSeconds / 60);
  const seconds = durationSeconds % 60;
  const durationStr = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;

  return (
    <div
      className="min-h-screen w-full flex flex-col"
      style={{
        ...dmSans,
        background: "#F7FAF2",
        backgroundImage:
          "radial-gradient(rgba(144, 171, 139, 0.4) 1.2px, transparent 1.2px)",
        backgroundSize: "28px 28px",
      }}
    >
      <header
        className="flex items-center"
        style={{ padding: "24px 32px" }}
      >
        <div className="flex items-center gap-3">
          <div
            style={{
              width: 28, height: 28, borderRadius: 8, background: "#3B4953",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#EBF4DD", ...dmSerif, fontSize: 16,
            }}
          >m</div>
          <div style={{ ...dmSerif, fontSize: 22, color: "#3B4953", letterSpacing: -0.2 }}>
            magicus
          </div>
        </div>
      </header>

      <section className="flex-1 flex items-center justify-center" style={{ padding: "32px 24px 80px" }}>
        <div className="w-full max-w-[640px] mx-auto flex flex-col items-center text-center">
          <div
            style={{
              color: "#547863",
              fontSize: 12,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              fontWeight: 500,
              marginBottom: 16,
            }}
          >
            Your recording
          </div>
          <h1
            className="text-[34px] md:text-[44px]"
            style={{
              ...dmSerif,
              color: "#3B4953",
              lineHeight: 1.05,
              letterSpacing: -0.5,
              marginBottom: 32,
            }}
          >
            Ready to map this?
          </h1>

          <div
            className="w-full"
            style={{
              maxWidth: 560,
              background: "#FFFFFF",
              border: "1px solid #EBF4DD",
              borderRadius: 16,
              boxShadow: "0 8px 32px rgba(59, 73, 83, 0.10)",
              overflow: "hidden",
              marginBottom: 28,
              textAlign: "left",
            }}
          >
            {thumbnail ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={thumbnail}
                alt="Recording thumbnail"
                style={{ width: "100%", height: 280, objectFit: "cover", display: "block" }}
              />
            ) : (
              <div
                style={{
                  width: "100%",
                  height: 280,
                  background: "#EBF4DD",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#547863",
                  fontSize: 13,
                }}
              >
                Recording captured
              </div>
            )}
            <div style={{ padding: "16px 20px 20px" }}>
              <div className="flex items-center gap-3" style={{ fontSize: 13, color: "#547863" }}>
                <span style={{ fontVariantNumeric: "tabular-nums", color: "#3B4953", fontWeight: 500 }}>
                  {durationStr}
                </span>
                <span style={{ color: "#90AB8B" }}>·</span>
                <span>{wordCount} {wordCount === 1 ? "word" : "words"} of narration</span>
              </div>
              {excerpt && (
                <div style={{ marginTop: 10, fontSize: 13, color: "#3B4953", lineHeight: 1.5 }}>
                  &ldquo;{excerpt}{transcript.length > 100 ? "…" : ""}&rdquo;
                </div>
              )}
              {noNarration && (
                <div
                  style={{
                    marginTop: 14,
                    padding: "8px 12px",
                    background: "rgba(245, 158, 11, 0.12)",
                    border: "1px solid rgba(245, 158, 11, 0.35)",
                    borderRadius: 8,
                    fontSize: 12,
                    color: "#8A4B0F",
                    lineHeight: 1.45,
                  }}
                >
                  No narration detected — your workflow will be less detailed.
                  Consider re-recording with narration.
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col items-center gap-3">
            <button
              onClick={onMap}
              className="hover:opacity-90 transition-opacity flex items-center gap-2"
              style={{
                background: "#3B4953",
                color: "#EBF4DD",
                padding: "14px 28px",
                borderRadius: 999,
                fontSize: 15,
                fontWeight: 500,
                border: "none",
                cursor: "pointer",
              }}
            >
              Map my workflow
              <ArrowRight size={16} />
            </button>
            <button
              onClick={onReRecord}
              className="hover:bg-[#EBF4DD] transition-colors"
              style={{
                background: "transparent",
                color: "#547863",
                padding: "10px 22px",
                borderRadius: 999,
                fontSize: 14,
                fontWeight: 500,
                border: "1px solid #90AB8B",
                cursor: "pointer",
              }}
            >
              Re-record
            </button>
            <button
              onClick={onCancel}
              className="hover:underline"
              style={{
                background: "transparent",
                color: "#547863",
                fontSize: 13,
                fontWeight: 500,
                border: "none",
                padding: "8px 12px",
                cursor: "pointer",
              }}
            >
              Describe instead
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function ProcessingScreen() {
  const messages = [
    "Reading your recording…",
    "Identifying the tools you used…",
    "Mapping your steps…",
    "Scoring automation potential…",
    "Almost there…",
  ];
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => {
      setIdx((i) => Math.min(i + 1, messages.length - 1));
    }, 3500);
    return () => clearInterval(t);
  }, [messages.length]);

  return (
    <div
      className="min-h-screen w-full flex flex-col"
      style={{ background: "#1C2420", color: "#EBF4DD", ...dmSans }}
    >
      <header className="flex items-center" style={{ padding: "24px 32px" }}>
        <div className="flex items-center gap-3">
          <div
            style={{
              width: 28, height: 28, borderRadius: 8, background: "#EBF4DD",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#1C2420", ...dmSerif, fontSize: 16,
            }}
          >m</div>
          <div style={{ ...dmSerif, fontSize: 22, color: "#EBF4DD", letterSpacing: -0.2 }}>
            magicus
          </div>
        </div>
      </header>

      <section className="flex-1 flex flex-col items-center justify-center" style={{ padding: "32px 24px 80px" }}>
        <div style={{ filter: "saturate(0.85) brightness(1.05)" }}>
          <AnimatedButterfly />
        </div>
        <div
          key={idx}
          className="magicus-placeholder-fade"
          style={{
            ...dmSans,
            marginTop: 56,
            fontSize: 16,
            color: "#90AB8B",
            letterSpacing: 0.2,
            textAlign: "center",
            minHeight: 24,
          }}
        >
          {messages[idx]}
        </div>
      </section>
    </div>
  );
}

function ErrorScreen({
  onRetry,
  onCancel,
  reason,
}: {
  onRetry: () => void;
  onCancel: () => void;
  reason?: string | null;
}) {
  return (
    <div
      className="min-h-screen w-full flex flex-col"
      style={{
        background: "#F7FAF2",
        backgroundImage:
          "radial-gradient(rgba(144, 171, 139, 0.4) 1.2px, transparent 1.2px)",
        backgroundSize: "28px 28px",
        ...dmSans,
      }}
    >
      <header className="flex items-center" style={{ padding: "24px 32px" }}>
        <div className="flex items-center gap-3">
          <div
            style={{
              width: 28, height: 28, borderRadius: 8, background: "#3B4953",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#EBF4DD", ...dmSerif, fontSize: 16,
            }}
          >m</div>
          <div style={{ ...dmSerif, fontSize: 22, color: "#3B4953", letterSpacing: -0.2 }}>
            magicus
          </div>
        </div>
      </header>

      <section className="flex-1 flex items-center justify-center" style={{ padding: "32px 24px 80px" }}>
        <div className="w-full max-w-[520px] mx-auto flex flex-col items-center text-center">
          <Sparkles size={28} style={{ color: "#90AB8B", marginBottom: 16 }} />
          <h1
            className="text-[34px] md:text-[40px]"
            style={{
              ...dmSerif,
              color: "#3B4953",
              lineHeight: 1.1,
              letterSpacing: -0.4,
              marginBottom: 14,
            }}
          >
            Something didn&apos;t quite work
          </h1>
          <p style={{ fontSize: 15, color: "#547863", lineHeight: 1.55, marginBottom: reason ? 16 : 32, maxWidth: 440 }}>
            We couldn&apos;t map your workflow from that recording. This sometimes
            happens with very short recordings or connection issues.
          </p>
          {reason && (
            <div
              style={{
                fontSize: 12,
                color: "#8B2A2A",
                background: "#FDECEC",
                border: "1px solid #E5A8A8",
                borderRadius: 8,
                padding: "8px 12px",
                marginBottom: 24,
                maxWidth: 440,
                lineHeight: 1.45,
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                wordBreak: "break-word",
              }}
            >
              {reason}
            </div>
          )}
          <div className="flex flex-col items-center gap-3">
            <button
              onClick={onRetry}
              className="hover:opacity-90 transition-opacity flex items-center gap-2"
              style={{
                background: "#3B4953",
                color: "#EBF4DD",
                padding: "12px 24px",
                borderRadius: 999,
                fontSize: 14,
                fontWeight: 500,
                border: "none",
                cursor: "pointer",
              }}
            >
              Try recording again
            </button>
            <button
              onClick={onCancel}
              className="hover:underline"
              style={{
                background: "transparent",
                color: "#547863",
                fontSize: 13,
                fontWeight: 500,
                border: "none",
                padding: "8px 12px",
                cursor: "pointer",
              }}
            >
              Describe your workflow instead
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

// ─── RecordingFlow main ────────────────────────────────────────────────────

export function RecordingFlow({
  onSuccess,
  onCancel,
}: {
  onSuccess: (workflow: RecordedWorkflow) => void;
  onCancel: () => void;
}) {
  const [stage, setStage] = useState<Stage>("prep");
  const [prepError, setPrepError] = useState<string | null>(null);
  const [reviewBlob, setReviewBlob] = useState<Blob | null>(null);
  const [reviewMime, setReviewMime] = useState<string>("");
  const [reviewDuration, setReviewDuration] = useState(0);
  const [reviewTranscript, setReviewTranscript] = useState("");
  const [reviewThumbnail, setReviewThumbnail] = useState<string | null>(null);
  // Diagnostic message routed to ErrorScreen so users (and us) can see why
  // the run failed instead of the generic 'something didn't quite work'.
  const [errorReason, setErrorReason] = useState<string | null>(null);

  const failTo = useCallback((reason: string) => {
    console.error("[recording-flow] error:", reason);
    setErrorReason(reason);
    setStage("error");
  }, []);

  const recorder = useRecorder();
  const showNudge =
    recorder.state === "recording" &&
    recorder.elapsedSec > 30 &&
    Date.now() - recorder.lastSpeechAt > 30000 &&
    recorder.transcript.trim().length === 0;

  const handleStart = useCallback(async () => {
    setPrepError(null);
    const result = await recorder.start();
    if (result.ok) {
      setStage("recording");
      return;
    }
    if (result.reason === "denied") {
      setPrepError(
        "Screen access denied. You can describe your workflow instead — or grant permission and try again."
      );
    } else {
      setPrepError("Your browser doesn't support screen recording. Try Chrome or describe your workflow instead.");
    }
  }, [recorder]);

  const handleStop = useCallback(async () => {
    const result = await recorder.stop();
    setReviewBlob(result.blob);
    setReviewMime(result.mimeType);
    setReviewDuration(result.durationSeconds);
    setReviewTranscript(result.transcript);
    // Best-effort thumbnail at the very start of the video.
    const thumb = await extractFrame(result.blob, 0.5).catch(() => null);
    setReviewThumbnail(thumb);
    recorder.cleanup();
    setStage("review");
  }, [recorder]);

  const handleReRecord = useCallback(() => {
    setReviewBlob(null);
    setReviewThumbnail(null);
    setReviewTranscript("");
    setReviewDuration(0);
    setStage("prep");
  }, []);

  const handleMap = useCallback(async () => {
    if (!reviewBlob) { failTo("No recording captured."); return; }
    if (reviewDuration < 15) {
      failTo(`Recording too short (${reviewDuration}s) — minimum is 15s.`);
      return;
    }
    if (reviewBlob.size === 0) {
      failTo("Recording captured 0 bytes — the screen-share stream may have ended before any chunks were emitted.");
      return;
    }
    setErrorReason(null);
    setStage("processing");
    try {
      console.info(
        `[recording-flow] uploading ${(reviewBlob.size / 1024 / 1024).toFixed(2)}MB ${reviewMime}, ${reviewDuration}s, transcript=${reviewTranscript.length}c`
      );

      // Step 1: client-direct upload to Vercel Blob. The browser hits our
      // /api/blob-upload route to mint a token, then PUTs the recording
      // straight to Blob storage — bypassing Vercel's 4.5MB function body
      // cap that previously broke 30s+ recordings.
      const ext = reviewMime.includes("mp4") ? "mp4" : "webm";
      const filename = `recordings/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      // Strip codec params (`video/webm;codecs=vp9,opus`) — Blob's content
      // type check is exact-match unless the allow list uses wildcards, and
      // even then a clean MIME type makes downstream Gemini handling tidier.
      const baseMime = reviewMime.split(";")[0].trim() || "video/webm";
      const uploaded = await upload(filename, reviewBlob, {
        access: "public",
        handleUploadUrl: "/api/blob-upload",
        contentType: baseMime,
      });

      // Step 2: tell our API where to find the recording. Tiny JSON payload,
      // no body-limit risk. The server fetches from Blob, ships to Gemini,
      // and deletes the blob when done.
      const res = await fetch("/api/record-to-workflow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          blobUrl: uploaded.url,
          transcript: reviewTranscript,
          durationSeconds: reviewDuration,
          mimeType: baseMime,
        }),
      });
      if (!res.ok) {
        // Try to surface the server's reason. For 413 Payload Too Large
        // (Vercel's body limit) we won't even get a JSON body back.
        let serverReason = `${res.status} ${res.statusText}`.trim();
        try {
          const text = await res.text();
          if (text) {
            try {
              const j = JSON.parse(text) as { error?: string };
              if (j.error) serverReason = `${res.status} — ${j.error}`;
            } catch {
              serverReason = `${res.status} — ${text.slice(0, 200)}`;
            }
          }
        } catch { /* fall through */ }
        failTo(`Server: ${serverReason}`);
        return;
      }
      const data = (await res.json()) as { workflow?: RecordedWorkflow; error?: string };
      if (!data.workflow) {
        failTo(`Server returned no workflow${data.error ? `: ${data.error}` : ""}.`);
        return;
      }

      // For each step the model returned a timestamp for, pull a frame from
      // the recording and attach it. Done client-side so we don't ship
      // ~50 base64 images back from the server.
      const enrichedSteps = await Promise.all(
        data.workflow.steps.map(async (step) => {
          if (typeof step.timestamp !== "number") return step;
          const shot = await extractFrame(reviewBlob, step.timestamp).catch(() => null);
          return shot ? { ...step, screenshot: shot } : step;
        })
      );
      onSuccess({ ...data.workflow, steps: enrichedSteps });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      failTo(`Network error: ${msg}`);
    }
  }, [reviewBlob, reviewDuration, reviewTranscript, reviewMime, onSuccess, failTo]);

  // Cancel from any screen — clean up streams and bubble up.
  const handleCancel = useCallback(() => {
    recorder.cleanup();
    onCancel();
  }, [recorder, onCancel]);

  if (stage === "prep") {
    return <PrepScreen onStart={handleStart} onCancel={handleCancel} errorMsg={prepError} />;
  }
  if (stage === "recording") {
    return (
      <RecordingScreen
        state={recorder.state}
        elapsedSec={recorder.elapsedSec}
        transcript={recorder.transcript}
        interim={recorder.interim}
        showNarrationNudge={showNudge}
        onPause={recorder.pause}
        onResume={recorder.resume}
        onStop={handleStop}
      />
    );
  }
  if (stage === "review") {
    return (
      <ReviewScreen
        thumbnail={reviewThumbnail}
        durationSeconds={reviewDuration}
        transcript={reviewTranscript}
        onMap={handleMap}
        onReRecord={handleReRecord}
        onCancel={handleCancel}
      />
    );
  }
  if (stage === "processing") {
    return <ProcessingScreen />;
  }
  return (
    <ErrorScreen
      onRetry={() => { setErrorReason(null); setStage("prep"); }}
      onCancel={handleCancel}
      reason={errorReason}
    />
  );
}

