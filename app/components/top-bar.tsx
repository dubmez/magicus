"use client";

import { Download, LayoutGrid, Library, Plus } from "lucide-react";

export type View = "canvas" | "library";

export function TopBar({
  view,
  onView,
  onExport,
  onNew,
}: {
  view: View;
  onView: (v: View) => void;
  onExport: () => void;
  onNew: () => void;
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

      <div
        className="flex"
        style={{
          background: "#F7FAF2",
          padding: 4,
          borderRadius: 999,
          border: "1px solid #EBF4DD",
        }}
      >
        {([
          { key: "canvas", label: "Canvas", icon: LayoutGrid },
          { key: "library", label: "Library", icon: Library },
        ] as const).map(({ key, label, icon: Icon }) => {
          const active = view === key;
          return (
            <button
              key={key}
              onClick={() => onView(key)}
              className="flex items-center gap-2 transition-all"
              style={{
                padding: "6px 14px",
                borderRadius: 999,
                background: active ? "#FFFFFF" : "transparent",
                color: active ? "#3B4953" : "#547863",
                fontSize: 13,
                fontWeight: active ? 500 : 400,
                border: active ? "1px solid #EBF4DD" : "1px solid transparent",
              }}
            >
              <Icon size={14} />
              {label}
            </button>
          );
        })}
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
