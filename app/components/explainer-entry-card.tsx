"use client";

import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { useAuth, useRequireAuth } from "@/lib/auth-context";

const dmSerifItalic = {
  fontFamily: "var(--font-dm-serif), serif",
  fontStyle: "italic" as const,
};
const dmSans = { fontFamily: "var(--font-dm-sans), sans-serif" };

const CORAL = "#E66B4D";
const INK = "#3B4953";
const SAGE = "#547863";
const SAGE_MUTED = "#90AB8B";
const CARD_BORDER = "#EBF4DD";

// "Share what you've built" entry point that sits below the build-new
// prompt box on the landing hero and beside "New workflow" inside the
// app via a different presentation. Auth-gates the click and persists
// the intent through OAuth via sessionStorage so the post-auth replay
// in app/page.tsx can route to /explainer/new.
export function ExplainerEntryCard({
  variant = "card",
}: {
  // "card" — full landing card on the dark hero
  // "compact" — slim variant (kept around for future top-bar use)
  variant?: "card" | "compact";
}) {
  const router = useRouter();
  const { user } = useAuth();
  const guard = useRequireAuth();

  const handleClick = () => {
    if (!user) {
      try {
        sessionStorage.setItem("magicus_pending_explainer", "1");
      } catch { /* storage disabled — auth gate still routes correctly */ }
    }
    guard(() => router.push("/explainer/new"));
  };

  if (variant === "compact") {
    return (
      <button
        onClick={handleClick}
        className="hover:underline flex items-center gap-1"
        style={{
          background: "transparent",
          color: SAGE,
          fontSize: 13,
          fontWeight: 500,
          border: "none",
          padding: "8px 12px",
          cursor: "pointer",
          ...dmSans,
        }}
      >
        Share what you&apos;ve built
        <ArrowRight size={13} />
      </button>
    );
  }

  return (
    <div
      className="w-full"
      style={{
        maxWidth: 680,
        background: "#FFFFFF",
        border: `1px solid ${CARD_BORDER}`,
        borderRadius: 16,
        padding: "20px 24px",
        ...dmSans,
      }}
    >
      <div
        className="flex flex-col md:flex-row items-start md:items-center gap-4"
        style={{ textAlign: "left" }}
      >
        <div style={{ flex: 1 }}>
          <div
            style={{
              color: SAGE_MUTED,
              fontSize: 11,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              fontWeight: 500,
              marginBottom: 6,
            }}
          >
            Share what you&apos;ve built
          </div>
          <div
            style={{
              ...dmSerifItalic,
              fontSize: 20,
              color: INK,
              lineHeight: 1.25,
              marginBottom: 8,
            }}
          >
            Turn what you&apos;ve built into something your team can learn from.
          </div>
          <p
            style={{
              fontSize: 14,
              color: SAGE,
              lineHeight: 1.55,
            }}
          >
            Record a short walkthrough of an automation you&apos;ve already
            built. Magicus turns it into a shareable explainer your colleagues
            can read, use, and build on.
          </p>
        </div>
        <button
          onClick={handleClick}
          className="flex items-center gap-2 transition-opacity hover:opacity-95 flex-shrink-0"
          style={{
            background: CORAL,
            color: "#FFFFFF",
            padding: "11px 18px",
            borderRadius: 999,
            fontSize: 14,
            fontWeight: 500,
            border: "none",
            cursor: "pointer",
          }}
        >
          Share what you&apos;ve built
          <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}
