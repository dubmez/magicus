"use client";

import { Mic, Zap, Link2, ArrowRight } from "lucide-react";
import { useAuth, useRequireAuth } from "@/lib/auth-context";
import { AnimatedButterfly } from "./animated-butterfly";

const dmSerif = { fontFamily: "var(--font-dm-serif), serif", fontStyle: "italic" as const };
const dmSans = { fontFamily: "var(--font-dm-sans), sans-serif" };

export function LandingHero({
  onStartMapping,
  onBrowseExamples,
}: {
  onStartMapping: () => void;
  onBrowseExamples: () => void;
}) {
  const { user, openGate } = useAuth();
  const guard = useRequireAuth();

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
      {/* Top bar — logo left, sign-in right */}
      <header
        className="flex items-center justify-between"
        style={{ padding: "28px 32px" }}
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
        {!user && (
          <button
            onClick={() => openGate()}
            className="hover:bg-[#EBF4DD] transition-colors"
            style={{
              background: "transparent",
              color: "#547863",
              padding: "8px 18px",
              borderRadius: 999,
              fontSize: 13,
              fontWeight: 500,
              border: "1px solid transparent",
            }}
          >
            Sign in
          </button>
        )}
      </header>

      {/* Hero */}
      <section
        className="flex-1 flex items-center"
        style={{ padding: "32px 32px 64px" }}
      >
        <div
          className="w-full max-w-[1200px] mx-auto grid gap-12 md:gap-16 items-center"
          style={{ gridTemplateColumns: "1fr" }}
        >
          {/* Two-column on md+, stacked on mobile */}
          <div className="grid md:grid-cols-2 gap-12 md:gap-16 items-center">
            {/* Left — copy */}
            <div className="flex flex-col">
              <div
                style={{
                  color: "#547863",
                  fontSize: 12,
                  letterSpacing: 1.6,
                  textTransform: "uppercase",
                  fontWeight: 500,
                  marginBottom: 20,
                }}
              >
                Workflow intelligence for the AI era
              </div>

              <h1
                className="text-[44px] sm:text-[52px] md:text-[60px] lg:text-[64px]"
                style={{
                  ...dmSerif,
                  color: "#3B4953",
                  lineHeight: 1.05,
                  letterSpacing: -1,
                  marginBottom: 20,
                }}
              >
                Do it once.
                <br />
                Skip it forever.
              </h1>

              <p
                style={{
                  fontSize: 18,
                  color: "#547863",
                  lineHeight: 1.55,
                  maxWidth: 480,
                  marginBottom: 32,
                }}
              >
                You already know how your business works. Record yourself doing
                it once — Magicus maps it, scores it, and builds you an
                automation blueprint. You bring the magic.
              </p>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
                <button
                  onClick={() => guard(onStartMapping)}
                  className="hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                  style={{
                    background: "#3B4953",
                    color: "#EBF4DD",
                    padding: "16px 28px",
                    borderRadius: 999,
                    fontSize: 15,
                    fontWeight: 500,
                    border: "none",
                  }}
                >
                  Start mapping
                  <ArrowRight size={16} />
                </button>
                <button
                  onClick={onBrowseExamples}
                  className="hover:underline flex items-center justify-center gap-1"
                  style={{
                    background: "transparent",
                    color: "#547863",
                    padding: "16px 12px",
                    fontSize: 15,
                    fontWeight: 500,
                    border: "none",
                  }}
                >
                  Browse workflows
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>

            {/* Right — animated butterfly with subtle glow */}
            <div
              className="relative flex items-center justify-center"
              style={{ minHeight: 420 }}
            >
              <div className="magicus-hero-glow" />
              <div style={{ position: "relative", zIndex: 1 }}>
                <AnimatedButterfly />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Below the fold — feature pillars + social proof */}
      <section
        style={{
          padding: "72px 32px 96px",
          borderTop: "1px solid #EBF4DD",
          background: "#FFFFFF",
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
              icon={<Zap size={20} style={{ color: "#547863" }} fill="#547863" strokeWidth={0} />}
              title="Analyse"
              copy="See exactly which steps an agent can handle — and which need you."
            />
            <Pillar
              icon={<Link2 size={20} style={{ color: "#547863" }} />}
              title="Automate"
              copy="Get a precise, platform-specific build guide. Deploy in hours."
            />
          </div>

          <div
            style={{
              marginTop: 64,
              paddingTop: 32,
              borderTop: "1px solid #EBF4DD",
              fontSize: 13,
              color: "#90AB8B",
              textAlign: "center",
              letterSpacing: 0.2,
            }}
          >
            Join thousands of AI-pilled leaders automating their workflows
          </div>
        </div>
      </section>
    </div>
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
      <p style={{ fontSize: 14, color: "#547863", lineHeight: 1.55, maxWidth: 280 }}>
        {copy}
      </p>
    </div>
  );
}
