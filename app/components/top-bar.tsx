"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, Zap, LogOut } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

function UserMenu() {
  const { user, signOut, openGate } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  if (!user) {
    return (
      <button
        onClick={() => openGate()}
        className="hover:bg-[#EBF4DD] transition-colors"
        style={{
          background: "transparent",
          color: "#547863",
          padding: "8px 14px",
          borderRadius: 999,
          fontSize: 13,
          fontWeight: 500,
          border: "1px solid transparent",
        }}
      >
        Sign in
      </button>
    );
  }

  const initial = user.name?.[0]?.toUpperCase() ?? "?";

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="hover:opacity-90 transition-opacity"
        aria-label="Account menu"
        style={{
          width: 32,
          height: 32,
          borderRadius: 999,
          padding: 0,
          background: user.avatarUrl ? "#EBF4DD" : "#547863",
          color: "#FFFFFF",
          fontSize: 13,
          fontWeight: 600,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          border: "1px solid #EBF4DD",
        }}
      >
        {user.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.avatarUrl}
            alt=""
            referrerPolicy="no-referrer"
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          initial
        )}
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            right: 0,
            minWidth: 220,
            background: "#FFFFFF",
            border: "1px solid #EBF4DD",
            borderRadius: 12,
            padding: 6,
            boxShadow: "0 12px 32px rgba(59, 73, 83, 0.14)",
            zIndex: 80,
          }}
        >
          <div style={{ padding: "8px 10px 10px", borderBottom: "1px solid #EBF4DD", marginBottom: 4 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: "#3B4953", lineHeight: 1.3 }}>
              {user.name}
            </div>
            <div style={{ fontSize: 11, color: "#90AB8B", marginTop: 2, wordBreak: "break-all" }}>
              {user.email}
            </div>
          </div>
          <button
            onClick={() => { setOpen(false); signOut(); }}
            className="w-full flex items-center gap-2 hover:bg-[#F7FAF2] transition-colors"
            style={{
              padding: "8px 10px",
              borderRadius: 8,
              fontSize: 13,
              color: "#3B4953",
              background: "transparent",
              border: "none",
              textAlign: "left",
            }}
          >
            <LogOut size={13} style={{ color: "#547863" }} />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

export function TopBar({
  onNew,
  onAutomate,
  automateCount,
}: {
  onNew: () => void;
  onAutomate: () => void;
  automateCount: number;
}) {
  return (
    <div
      className="flex items-center justify-between px-4 md:px-6 gap-2"
      style={{
        height: 60,
        background: "#FFFFFF",
        borderBottom: "1px solid #EBF4DD",
        fontFamily: "var(--font-dm-sans), sans-serif",
        flexShrink: 0,
      }}
    >
      <div className="flex items-center gap-3 min-w-0">
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
            flexShrink: 0,
          }}
        >
          m
        </div>
        <div
          className="hidden sm:block"
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
        {/* New workflow sits with the logo cluster — it's the canvas-level
            create action and reads as 'left side' alongside the brand. */}
        <button
          onClick={onNew}
          className="flex items-center gap-2 transition-colors hover:bg-[#EBF4DD] ml-2 md:ml-4"
          style={{
            background: "transparent",
            color: "#547863",
            padding: "8px 12px",
            borderRadius: 999,
            fontSize: 13,
            fontWeight: 500,
            border: "1px solid transparent",
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
          title="New workflow"
          aria-label="New workflow"
        >
          <Plus size={14} />
          <span className="hidden md:inline">New workflow</span>
        </button>
      </div>

      <div className="flex items-center gap-1.5 md:gap-2">
        <button
          onClick={onAutomate}
          disabled={automateCount === 0}
          title={automateCount === 0 ? "Select a workflow first" : "Automate it"}
          aria-label="Automate it"
          className="flex items-center gap-2 transition-all hover:opacity-90"
          style={{
            background: automateCount > 0 ? "#547863" : "#EBF4DD",
            color: automateCount > 0 ? "#EBF4DD" : "#90AB8B",
            padding: "8px 14px",
            borderRadius: 999,
            fontSize: 13,
            fontWeight: 500,
            cursor: automateCount === 0 ? "not-allowed" : "pointer",
            transition: "background 0.15s",
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
        >
          <Zap size={14} fill={automateCount > 0 ? "#EBF4DD" : "#90AB8B"} strokeWidth={0} />
          <span className="hidden md:inline">Automate it</span>
          {automateCount > 0 && (
            <span
              style={{
                background: "#EBF4DD",
                color: "#3B4953",
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
        <div style={{ width: 8 }} />
        <UserMenu />
      </div>
    </div>
  );
}
