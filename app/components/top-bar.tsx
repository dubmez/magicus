"use client";

import { Download, Plus, Zap } from "lucide-react";

export function TopBar({
  onExport,
  onNew,
  onAutomate,
  automateCount,
}: {
  onExport: () => void;
  onNew: () => void;
  onAutomate: () => void;
  automateCount: number;
}) {
  return (
    <div
      className="flex items-center justify-between px-6"
      style={{
        height: 60,
        background: "#FFFFFF",
        borderBottom: "1px solid #EBF4DD",
        fontFamily: "var(--font-dm-sans), sans-serif",
        flexShrink: 0,
      }}
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
            fontFamily: "var(--font-dm-serif), serif",
            fontStyle: "italic",
            fontSize: 16,
          }}
        >
          m
        </div>
        <div
          style={{
            fontFamily: "var(--font-dm-serif), serif",
            fontStyle: "italic",
            fontSize: 22,
            color: "#3B4953",
            letterSpacing: -0.2,
          }}
        >
          magicus
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onNew}
          className="flex items-center gap-2 transition-colors hover:bg-[#EBF4DD]"
          style={{
            background: "#FFFFFF",
            color: "#3B4953",
            padding: "8px 14px",
            borderRadius: 999,
            fontSize: 13,
            fontWeight: 500,
            border: "1px solid #EBF4DD",
          }}
        >
          <Plus size={14} />
          New workflow
        </button>
        <button
          onClick={onAutomate}
          disabled={automateCount === 0}
          className="flex items-center gap-2 transition-all hover:opacity-90"
          style={{
            background: automateCount > 0 ? "#547863" : "#EBF4DD",
            color: automateCount > 0 ? "#EBF4DD" : "#90AB8B",
            padding: "8px 16px",
            borderRadius: 999,
            fontSize: 13,
            fontWeight: 500,
            cursor: automateCount === 0 ? "not-allowed" : "pointer",
            transition: "background 0.15s",
          }}
        >
          <Zap size={14} fill={automateCount > 0 ? "#EBF4DD" : "#90AB8B"} strokeWidth={0} />
          Automate it
          {automateCount > 0 && (
            <span
              style={{
                background: "rgba(235,244,221,0.25)",
                borderRadius: 999,
                padding: "1px 7px",
                fontSize: 11,
                fontWeight: 600,
              }}
            >
              {automateCount}
            </span>
          )}
        </button>
        <button
          onClick={onExport}
          className="flex items-center gap-2 transition-all hover:opacity-90"
          style={{
            background: "#3B4953",
            color: "#EBF4DD",
            padding: "8px 16px",
            borderRadius: 999,
            fontSize: 13,
            fontWeight: 500,
          }}
        >
          <Download size={14} />
          Export .md
        </button>
      </div>
    </div>
  );
}
