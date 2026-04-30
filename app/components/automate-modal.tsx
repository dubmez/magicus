"use client";

import { useState } from "react";
import { X, Zap, ChevronDown, Loader2 } from "lucide-react";
import type { Workflow, Connection } from "@/lib/workflows";

type PlatformState = "idle" | "loading" | "done" | "error";

function PlatformSection({
  label,
  icon,
  workflows,
  connections,
  platform,
}: {
  label: string;
  icon: React.ReactNode;
  workflows: Workflow[];
  connections: Connection[];
  platform: "zapier" | "n8n";
}) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<PlatformState>("idle");
  const [instructions, setInstructions] = useState("");

  const toggle = async () => {
    if (open) { setOpen(false); return; }
    setOpen(true);
    if (state !== "idle") return;
    setState("loading");
    try {
      const res = await fetch("/api/automate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workflows, connections, platform }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error ?? "Request failed");
      setInstructions(data.instructions);
      setState("done");
    } catch {
      setState("error");
    }
  };

  return (
    <div style={{ border: "1px solid #EBF4DD", borderRadius: 12, overflow: "hidden" }}>
      <button
        onClick={toggle}
        className="w-full flex items-center justify-between transition-colors hover:bg-[#FBFDF7]"
        style={{ padding: "14px 18px", background: open ? "#FBFDF7" : "#FFFFFF" }}
      >
        <div className="flex items-center gap-3">
          {icon}
          <span style={{ fontSize: 14, fontWeight: 500, color: "#3B4953" }}>{label}</span>
        </div>
        <div className="flex items-center gap-2">
          {state === "loading" && <Loader2 size={14} className="animate-spin" style={{ color: "#547863" }} />}
          <ChevronDown
            size={16}
            style={{
              color: "#547863",
              transform: open ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 0.2s",
            }}
          />
        </div>
      </button>

      {open && (
        <div style={{ borderTop: "1px solid #EBF4DD", background: "#F7FAF2", padding: "18px 20px" }}>
          {state === "loading" && (
            <div className="flex items-center gap-2" style={{ color: "#547863", fontSize: 13 }}>
              <Loader2 size={14} className="animate-spin" />
              Generating {label} instructions…
            </div>
          )}
          {state === "error" && (
            <div style={{ color: "#C0392B", fontSize: 13 }}>
              Something went wrong. Check your API key and try again.
            </div>
          )}
          {state === "done" && (
            <pre
              style={{
                fontFamily: "var(--font-dm-sans), sans-serif",
                fontSize: 13,
                color: "#3B4953",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                margin: 0,
                lineHeight: 1.6,
              }}
            >
              {instructions}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

function ZapierIcon() {
  return (
    <div
      style={{
        width: 28,
        height: 28,
        borderRadius: 8,
        background: "#FF4A00",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#FFFFFF",
        fontSize: 13,
        fontWeight: 700,
      }}
    >
      Z
    </div>
  );
}

function N8nIcon() {
  return (
    <div
      style={{
        width: 28,
        height: 28,
        borderRadius: 8,
        background: "#EA4B71",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#FFFFFF",
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: -0.5,
      }}
    >
      n8n
    </div>
  );
}

export function AutomateModal({
  open,
  workflows,
  connections,
  onClose,
}: {
  open: boolean;
  workflows: Workflow[];
  connections: Connection[];
  onClose: () => void;
}) {
  if (!open || workflows.length === 0) return null;

  const title =
    workflows.length === 1
      ? workflows[0].name
      : `${workflows.length} workflows`;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{
        background: "rgba(59, 73, 83, 0.4)",
        zIndex: 100,
        padding: 24,
        fontFamily: "var(--font-dm-sans), sans-serif",
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#FFFFFF",
          borderRadius: 16,
          width: "min(680px, 100%)",
          maxHeight: "85vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          border: "1px solid #EBF4DD",
          boxShadow: "0px 12px 48px rgba(59, 73, 83, 0.16)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between"
          style={{ padding: "16px 20px", borderBottom: "1px solid #EBF4DD" }}
        >
          <div>
            <div className="flex items-center gap-2">
              <Zap size={15} style={{ color: "#547863" }} fill="#547863" />
              <div
                style={{
                  fontFamily: "var(--font-dm-serif), serif",
                  fontStyle: "italic",
                  fontSize: 18,
                  color: "#3B4953",
                }}
              >
                Automate it
              </div>
            </div>
            <div style={{ fontSize: 12, color: "#547863", marginTop: 3 }}>
              {title} · expand a platform to generate instructions
            </div>
          </div>
          <button
            onClick={onClose}
            className="hover:bg-[#EBF4DD] rounded-md p-2"
            style={{ color: "#547863" }}
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 10 }}>
          <PlatformSection
            key="zapier"
            label="Zapier"
            icon={<ZapierIcon />}
            workflows={workflows}
            connections={connections}
            platform="zapier"
          />
          <PlatformSection
            key="n8n"
            label="n8n"
            icon={<N8nIcon />}
            workflows={workflows}
            connections={connections}
            platform="n8n"
          />
        </div>
      </div>
    </div>
  );
}
