"use client";

import { Zap } from "lucide-react";

const dmSans = { fontFamily: "var(--font-dm-sans), sans-serif" };
const dmSerif = { fontFamily: "var(--font-dm-serif), serif", fontStyle: "italic" as const };

// Faithful CSS recreation of ButterflyCard, used as a hero element.
// Each piece animates in via the magicus-hero-element keyframes with a
// staggered delay; the whole sequence loops every 12 seconds.
export function AnimatedButterfly() {
  return (
    <div
      style={{
        position: "relative",
        width: 480,
        maxWidth: "100%",
        ...dmSans,
        filter: "drop-shadow(0px 16px 36px rgba(59, 73, 83, 0.10))",
      }}
    >
      {/* Dashed outline — fades in first, stays through the cycle */}
      <div
        aria-hidden
        className="magicus-hero-outline-anim"
        style={{
          position: "absolute",
          inset: -8,
          borderRadius: 28,
          border: "1.5px dashed #90AB8B",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />

      {/* Automatable pill (top-right) */}
      <div
        className="magicus-hero-anim"
        style={{
          ["--delay" as string]: "1.0s",
          position: "absolute",
          top: 0,
          right: 0,
          background: "#547863",
          color: "#EBF4DD",
          fontSize: 10,
          fontWeight: 500,
          padding: "5px 10px",
          borderRadius: 999,
          letterSpacing: 0.3,
          display: "flex",
          alignItems: "center",
          gap: 4,
          zIndex: 20,
        }}
      >
        <Zap size={12} fill="#EBF4DD" strokeWidth={0} />
        Automatable
      </div>

      {/* HEAD */}
      <div className="flex justify-center">
        <div
          className="magicus-hero-anim"
          style={{
            ["--delay" as string]: "0.4s",
            background: "#3B4953",
            borderRadius: 16,
            padding: "14px 22px",
            width: 240,
            textAlign: "center",
            position: "relative",
            zIndex: 10,
          }}
        >
          <div style={{ ...dmSerif, color: "#FFFFFF", fontSize: 16, lineHeight: 1.2 }}>
            Inbound lead qualification
          </div>
        </div>
      </div>

      {/* WINGS + BODY */}
      <div className="flex items-stretch" style={{ marginTop: -8 }}>
        {/* LEFT WING (Inputs) */}
        <div
          className="magicus-hero-anim"
          style={{
            ["--delay" as string]: "2.4s",
            flex: 1,
            background: "#EBF4DD",
            borderTopLeftRadius: 20,
            borderBottomLeftRadius: 28,
            padding: "20px 16px 20px 20px",
            borderRight: "1.5px dashed #90AB8B",
          }}
        >
          <div
            style={{
              fontSize: 10,
              fontWeight: 600,
              color: "#547863",
              letterSpacing: 1.4,
              textTransform: "uppercase",
              marginBottom: 10,
            }}
          >
            Inputs
          </div>
          <div className="flex flex-col gap-1.5">
            <IOCard name="Lead form data" source="Website" align="left" />
            <IOCard name="ICP criteria" source="Notion" align="left" />
          </div>
        </div>

        {/* BODY (Steps) */}
        <div
          style={{
            width: 200,
            background: "#FFFFFF",
            padding: "18px 14px",
            position: "relative",
          }}
        >
          <div
            aria-hidden
            style={{
              position: "absolute",
              left: "50%",
              top: 24,
              bottom: 24,
              width: 0,
              borderLeft: "1.5px dashed #90AB8B",
              transform: "translateX(-0.75px)",
              zIndex: 0,
            }}
          />
          <div className="relative flex flex-col gap-2" style={{ zIndex: 1 }}>
            <Step n={1} text="Receive inbound lead" delay="0.9s" />
            <Step n={2} text="Score against ICP" delay="1.4s" note="If score > 7, proceed" />
            <Step n={3} text="Send personalised outreach" delay="1.9s" />
          </div>
        </div>

        {/* RIGHT WING (Outputs) */}
        <div
          className="magicus-hero-anim"
          style={{
            ["--delay" as string]: "2.4s",
            flex: 1,
            background: "#EBF4DD",
            borderTopRightRadius: 20,
            borderBottomRightRadius: 28,
            padding: "20px 20px 20px 16px",
            borderLeft: "1.5px dashed #90AB8B",
          }}
        >
          <div
            style={{
              fontSize: 10,
              fontWeight: 600,
              color: "#547863",
              letterSpacing: 1.4,
              textTransform: "uppercase",
              marginBottom: 10,
              textAlign: "right",
            }}
          >
            Outputs
          </div>
          <div className="flex flex-col gap-1.5">
            <IOCard name="Qualified lead record" source="HubSpot" align="right" />
            <IOCard name="Follow-up sent" source="Gmail" align="right" />
          </div>
        </div>
      </div>

      {/* FOOT — tools tray */}
      <div className="flex justify-center" style={{ marginTop: -8 }}>
        <div
          className="magicus-hero-anim"
          style={{
            ["--delay" as string]: "2.9s",
            background: "#547863",
            borderRadius: 14,
            padding: "8px 14px",
            display: "flex",
            gap: 6,
            zIndex: 10,
            position: "relative",
          }}
        >
          {["HubSpot", "Gmail", "Notion"].map((t) => (
            <span
              key={t}
              style={{
                background: "rgba(255, 255, 255, 0.18)",
                color: "#FFFFFF",
                fontSize: 10,
                fontWeight: 500,
                padding: "3px 9px",
                borderRadius: 999,
              }}
            >
              {t}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function Step({ n, text, note, delay }: { n: number; text: string; note?: string; delay: string }) {
  return (
    <div
      className="magicus-hero-anim"
      style={{
        ["--delay" as string]: delay,
        background: "#F7FAF2",
        borderRadius: 10,
        padding: "8px 10px",
        display: "flex",
        gap: 8,
        alignItems: "flex-start",
      }}
    >
      <span
        style={{
          background: "#547863",
          color: "#FFFFFF",
          fontSize: 10,
          fontWeight: 600,
          width: 18,
          height: 18,
          borderRadius: 999,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          marginTop: 1,
        }}
      >
        {n}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{ fontSize: 11, color: "#3B4953", lineHeight: 1.35 }}>{text}</span>
        {note && (
          <div style={{ ...dmSerif, fontSize: 10, color: "#547863", marginTop: 2 }}>
            {note}
          </div>
        )}
      </div>
    </div>
  );
}

function IOCard({ name, source, align }: { name: string; source: string; align: "left" | "right" }) {
  return (
    <div
      className="bg-white rounded-[10px] px-3 py-2"
      style={{
        textAlign: align === "left" ? "left" : "right",
        boxShadow: "0px 1px 2px rgba(59, 73, 83, 0.06)",
      }}
    >
      <div style={{ fontSize: 12, color: "#3B4953", fontWeight: 500, lineHeight: 1.3 }}>
        {name}
      </div>
      <div style={{ fontSize: 10, color: "#90AB8B", marginTop: 2, lineHeight: 1.3 }}>
        {source}
      </div>
    </div>
  );
}
