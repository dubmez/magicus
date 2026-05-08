"use client";

import { Compass, Zap, Layers } from "lucide-react";
import type { ConversationPath } from "@/lib/conversation";

const dmSerif = { fontFamily: "var(--font-dm-serif), serif", fontStyle: "italic" as const };
const dmSans = { fontFamily: "var(--font-dm-sans), sans-serif" };

const PATHS: {
  key: ConversationPath;
  label: string;
  description: string;
  Icon: typeof Compass;
}[] = [
  {
    key: "explore",
    label: "Help me figure out where to start",
    description:
      "Not sure what to automate first? We'll help you find the best starting point.",
    Icon: Compass,
  },
  {
    key: "quick",
    label: "Map a workflow quickly",
    description:
      "Get a workflow mapped in a few questions. Good for when you know roughly what you want.",
    Icon: Zap,
  },
  {
    key: "deep",
    label: "Go deep on one workflow",
    description:
      "Build a fully specified workflow with edge cases and connector details — ready to hand off or build from.",
    Icon: Layers,
  },
];

// Renders the user's quoted description above three stacked path
// cards. Caller decides what to do once a path is picked.
export function PathPicker({
  description,
  selected,
  onPick,
}: {
  description: string;
  // If set, that card renders in the "active" style. Useful when the
  // parent is mid-transition between picker and chat — the user sees
  // their pick highlighted before the picker fades out.
  selected?: ConversationPath | null;
  onPick: (path: ConversationPath) => void;
}) {
  return (
    <div className="magicus-chat-appear" style={{ ...dmSans }}>
      <blockquote
        style={{
          ...dmSerif,
          fontSize: 15,
          color: "#547863",
          margin: 0,
          marginBottom: 14,
          lineHeight: 1.45,
          paddingLeft: 12,
          borderLeft: "2px solid #EBF4DD",
        }}
      >
        &ldquo;{description}&rdquo;
      </blockquote>

      <div className="flex flex-col gap-2">
        {PATHS.map(({ key, label, description: desc, Icon }, i) => {
          const isActive = selected === key;
          return (
            <button
              key={key}
              onClick={() => onPick(key)}
              className="text-left transition-colors magicus-chat-appear"
              style={{
                background: isActive ? "#F7FAF2" : "#FFFFFF",
                border: isActive ? "1px solid #547863" : "1px solid #EBF4DD",
                borderRadius: 12,
                padding: "14px 16px",
                cursor: "pointer",
                animationDelay: `${i * 60}ms`,
                display: "flex",
                gap: 12,
                alignItems: "flex-start",
              }}
              onMouseEnter={(e) => {
                if (!isActive) e.currentTarget.style.background = "#F7FAF2";
              }}
              onMouseLeave={(e) => {
                if (!isActive) e.currentTarget.style.background = "#FFFFFF";
              }}
            >
              <div
                style={{
                  flexShrink: 0,
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: "#EBF4DD",
                  color: "#547863",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginTop: 2,
                }}
                aria-hidden="true"
              >
                <Icon size={16} />
              </div>
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    ...dmSerif,
                    fontSize: 16,
                    color: "#3B4953",
                    lineHeight: 1.3,
                    marginBottom: 4,
                  }}
                >
                  {label}
                </div>
                <div
                  style={{
                    fontSize: 13,
                    color: "#90AB8B",
                    lineHeight: 1.45,
                  }}
                >
                  {desc}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
