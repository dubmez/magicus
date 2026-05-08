"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Circle } from "lucide-react";
import { useAuth, useRequireAuth } from "@/lib/auth-context";
import { LogoMark } from "@/app/components/logo";
import { RecordingFlow } from "@/app/components/recording-flow";

const dmSerif = { fontFamily: "var(--font-dm-serif), serif" };
const dmSerifItalic = {
  fontFamily: "var(--font-dm-serif), serif",
  fontStyle: "italic" as const,
};
const dmSans = { fontFamily: "var(--font-dm-sans), sans-serif" };

const CORAL = "#E66B4D";
const APP_BG = "#F7FAF2";
const INK = "#3B4953";
const SAGE = "#547863";
const SAGE_MUTED = "#90AB8B";
const CARD_BORDER = "#EBF4DD";

const PROMPTS = [
  "What problem does this solve — and who is it for?",
  "Walk through what happens — what triggers it, what it does, what comes out.",
  "How would someone use this or run their own version?",
  "How did you build it — tools, time, what was tricky?",
];

export default function ExplainerNewPage() {
  const router = useRouter();
  const guard = useRequireAuth();
  const { user, hydrated } = useAuth();
  const [recording, setRecording] = useState(false);

  const startRecording = () => {
    guard(() => setRecording(true));
  };

  const switchToText = () => {
    router.push("/");
  };

  // Recording mounted: hand the whole viewport over to the existing
  // capture/review/processing UI. On success, hop into the draft editor.
  if (recording) {
    return (
      <RecordingFlow
        mode="explainer"
        onExplainerSuccess={({ id }) => {
          router.push(`/explainer/draft/${id}`);
        }}
        onCancel={() => setRecording(false)}
      />
    );
  }

  return (
    <div
      className="min-h-screen w-full flex flex-col"
      style={{ background: APP_BG, ...dmSans }}
    >
      {/* Header — matches the in-app top bar's restraint */}
      <header
        className="flex items-center justify-between"
        style={{ padding: "20px 28px" }}
      >
        <Link
          href="/"
          aria-label="Magicus home"
          className="flex items-center gap-2.5"
          style={{ textDecoration: "none" }}
        >
          <LogoMark variant="coral" size={28} />
          <span style={{ ...dmSerifItalic, fontSize: 22, color: INK }}>
            magicus
          </span>
        </Link>
        <div
          className="flex items-center gap-1.5"
          style={{
            background: "#FBE6E0",
            color: CORAL,
            border: `1px solid ${CORAL}33`,
            borderRadius: 999,
            padding: "5px 12px",
            fontSize: 12,
            fontWeight: 500,
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: 999,
              background: CORAL,
              display: "inline-block",
            }}
          />
          Public Explainer
        </div>
      </header>

      <main
        className="flex-1 flex flex-col items-center"
        style={{ padding: "48px 24px 64px" }}
      >
        <div
          className="w-full text-center"
          style={{ maxWidth: 720 }}
        >
          <div
            style={{
              color: SAGE_MUTED,
              fontSize: 12,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              fontWeight: 500,
              marginBottom: 18,
            }}
          >
            Share what you&apos;ve built
          </div>

          <h1
            className="text-[36px] md:text-[52px]"
            style={{
              ...dmSerif,
              fontWeight: 700,
              color: INK,
              lineHeight: 1.1,
              letterSpacing: -0.5,
              marginBottom: 16,
            }}
          >
            Walk us through it.{" "}
            <span style={{ ...dmSerifItalic, color: CORAL }}>
              We&apos;ll do the writing.
            </span>
          </h1>

          <p
            className="text-[15px] md:text-[16px]"
            style={{
              color: SAGE,
              lineHeight: 1.55,
              maxWidth: 540,
              margin: "0 auto 36px",
            }}
          >
            A few prompts to keep in mind while you record. You don&apos;t need
            to cover them in order — just talk naturally.
          </p>

          <div
            className="grid gap-3"
            style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", marginBottom: 22 }}
          >
            {PROMPTS.map((prompt, i) => (
              <div
                key={i}
                className="text-left flex gap-4 items-start"
                style={{
                  background: "#FFFFFF",
                  border: `1px solid ${CARD_BORDER}`,
                  borderRadius: 12,
                  padding: "16px 20px",
                }}
              >
                <span
                  style={{
                    ...dmSerifItalic,
                    color: CORAL,
                    fontSize: 18,
                    fontWeight: 500,
                    flexShrink: 0,
                    paddingTop: 2,
                  }}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span
                  style={{
                    fontSize: 14,
                    color: INK,
                    fontWeight: 500,
                    lineHeight: 1.45,
                  }}
                >
                  {prompt}
                </span>
              </div>
            ))}
          </div>

          <p
            style={{
              fontSize: 13,
              color: SAGE_MUTED,
              fontStyle: "italic",
              lineHeight: 1.5,
              marginBottom: 28,
            }}
          >
            You don&apos;t need to cover these in order. Just talk naturally —
            we&apos;ll structure it.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={startRecording}
              disabled={!hydrated}
              className="flex items-center gap-2 transition-opacity hover:opacity-95"
              style={{
                background: CORAL,
                color: "#FFFFFF",
                padding: "12px 22px",
                borderRadius: 999,
                fontSize: 15,
                fontWeight: 500,
                border: "none",
                cursor: hydrated ? "pointer" : "wait",
              }}
              aria-label="Start recording"
            >
              <Circle size={10} fill="#FFFFFF" stroke="none" />
              Start recording
              <ArrowRight size={14} />
            </button>
            <button
              onClick={switchToText}
              className="hover:bg-[#EBF4DD] transition-colors"
              style={{
                background: "transparent",
                color: SAGE,
                border: `1px solid ${SAGE}55`,
                padding: "12px 22px",
                borderRadius: 999,
                fontSize: 14,
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Or describe it in text instead
            </button>
          </div>

          {!user && hydrated && (
            <p
              style={{
                marginTop: 20,
                fontSize: 12,
                color: SAGE_MUTED,
              }}
            >
              You&apos;ll be asked to sign in before recording starts.
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
