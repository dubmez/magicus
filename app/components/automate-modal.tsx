"use client";

import { useEffect, useRef, useState } from "react";
import { X, Zap, ChevronDown, Loader2, Copy, Check, RefreshCw } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";
import type { Workflow, Connection } from "@/lib/workflows";

type PlatformState = "idle" | "loading" | "done" | "error";
type ViewMode = "read" | "markdown";

const dmSerif = { fontFamily: "var(--font-dm-serif), serif", fontStyle: "italic" as const };

const mdComponents: Components = {
  h1: ({ children }) => (
    <h1 style={{ ...dmSerif, fontSize: 20, color: "#3B4953", marginTop: 8, marginBottom: 12, lineHeight: 1.25 }}>
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 style={{ ...dmSerif, fontSize: 16, color: "#3B4953", marginTop: 18, marginBottom: 8, lineHeight: 1.3 }}>
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3
      style={{
        fontSize: 11,
        fontWeight: 600,
        color: "#547863",
        marginTop: 14,
        marginBottom: 6,
        textTransform: "uppercase",
        letterSpacing: 0.8,
      }}
    >
      {children}
    </h3>
  ),
  p: ({ children }) => (
    <p style={{ fontSize: 13, color: "#3B4953", lineHeight: 1.6, marginBottom: 10 }}>{children}</p>
  ),
  ul: ({ children }) => (
    <ul style={{ paddingLeft: 18, marginBottom: 10, listStyleType: "disc" }}>{children}</ul>
  ),
  ol: ({ children }) => (
    <ol style={{ paddingLeft: 22, marginBottom: 10, listStyleType: "decimal" }}>{children}</ol>
  ),
  li: ({ children, className }) => {
    const isTask = className?.includes("task-list-item");
    return (
      <li
        style={{
          fontSize: 13,
          color: "#3B4953",
          lineHeight: 1.6,
          marginBottom: 4,
          listStyle: isTask ? "none" : undefined,
          marginLeft: isTask ? -18 : undefined,
        }}
      >
        {children}
      </li>
    );
  },
  input: ({ type, checked, disabled }) => {
    if (type !== "checkbox") return null;
    return (
      <input
        type="checkbox"
        checked={!!checked}
        disabled={disabled}
        readOnly
        style={{
          accentColor: "#547863",
          marginRight: 8,
          transform: "translateY(1px)",
          width: 13,
          height: 13,
        }}
      />
    );
  },
  strong: ({ children }) => (
    <strong style={{ color: "#3B4953", fontWeight: 600 }}>{children}</strong>
  ),
  em: ({ children }) => <em style={{ color: "#547863" }}>{children}</em>,
  code: ({ children }) => (
    <code
      style={{
        background: "#EBF4DD",
        padding: "1px 6px",
        borderRadius: 4,
        fontSize: 12,
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        color: "#3B4953",
      }}
    >
      {children}
    </code>
  ),
  hr: () => <hr style={{ border: "none", borderTop: "1px solid #EBF4DD", margin: "16px 0" }} />,
  a: ({ children, href }) => (
    <a href={href} target="_blank" rel="noreferrer" style={{ color: "#547863", textDecoration: "underline" }}>
      {children}
    </a>
  ),
};

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
  const [mode, setMode] = useState<ViewMode>("read");
  const [copied, setCopied] = useState(false);
  const readRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLButtonElement>(null);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchInstructions = async () => {
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

  const toggle = async () => {
    if (open) { setOpen(false); return; }
    setOpen(true);
    if (state !== "idle") return;
    await fetchInstructions();
  };

  const retry = async () => {
    setState("idle");
    await fetchInstructions();
  };

  // When content finishes loading, scroll the section header into view
  // so the user sees the title first instead of mid-document.
  useEffect(() => {
    if (state === "done") {
      headerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [state]);

  const handleCopy = async () => {
    const text =
      mode === "markdown"
        ? instructions
        : (readRef.current?.innerText ?? instructions);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard refused — fall through silently
    }
  };

  return (
    <div style={{ border: "1px solid #EBF4DD", borderRadius: 12, overflow: "hidden", flexShrink: 0 }}>
      <button
        ref={headerRef}
        onClick={toggle}
        className="w-full flex items-center justify-between transition-colors hover:bg-[#FBFDF7]"
        style={{ padding: "14px 18px", background: open ? "#FBFDF7" : "#FFFFFF" }}
      >
        <div className="flex items-center gap-3">
          {icon}
          <span style={{ fontSize: 14, fontWeight: 500, color: "#3B4953" }}>{label}</span>
        </div>
        <div className="flex items-center gap-2">
          {state === "loading" && (
            <Loader2 size={14} className="animate-spin" style={{ color: "#547863" }} />
          )}
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
        <div style={{ borderTop: "1px solid #EBF4DD", background: "#F7FAF2" }}>
          {state === "loading" && (
            <div
              className="flex items-center gap-2"
              style={{ padding: "18px 20px", color: "#547863", fontSize: 13 }}
            >
              <Loader2 size={14} className="animate-spin" />
              Generating {label} instructions…
            </div>
          )}
          {state === "error" && (
            <div
              style={{
                padding: "16px 20px",
                fontSize: 13,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <span style={{ color: "#C0392B" }}>
                Something went wrong. Check your API key and try again.
              </span>
              <button
                onClick={retry}
                className="flex items-center gap-1.5 transition-colors hover:bg-[#EBF4DD]"
                style={{
                  padding: "6px 12px",
                  borderRadius: 999,
                  fontSize: 12,
                  fontWeight: 500,
                  color: "#3B4953",
                  background: "#FFFFFF",
                  border: "1px solid #EBF4DD",
                  flexShrink: 0,
                }}
              >
                <RefreshCw size={12} />
                Try again
              </button>
            </div>
          )}
          {state === "done" && (
            <>
              {/* Toggle + Copy row */}
              <div
                className="flex items-center justify-between"
                style={{
                  padding: "10px 14px",
                  borderBottom: "1px solid #EBF4DD",
                }}
              >
                <div
                  className="flex"
                  style={{
                    background: "#FFFFFF",
                    border: "1px solid #EBF4DD",
                    borderRadius: 999,
                    padding: 3,
                  }}
                >
                  {([
                    { mode: "read" as const, label: "Formatted" },
                    { mode: "markdown" as const, label: "Raw text" },
                  ]).map(({ mode: m, label }) => {
                    const active = mode === m;
                    return (
                      <button
                        key={m}
                        onClick={() => setMode(m)}
                        style={{
                          padding: "4px 12px",
                          borderRadius: 999,
                          fontSize: 11,
                          fontWeight: active ? 500 : 400,
                          background: active ? "#3B4953" : "transparent",
                          color: active ? "#EBF4DD" : "#547863",
                          transition: "background 0.12s, color 0.12s",
                        }}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 transition-colors hover:bg-[#EBF4DD]"
                  style={{
                    padding: "5px 10px",
                    borderRadius: 999,
                    fontSize: 11,
                    color: copied ? "#547863" : "#547863",
                    background: copied ? "#EBF4DD" : "transparent",
                    fontWeight: 500,
                  }}
                  aria-label="Copy"
                >
                  {copied ? <Check size={12} /> : <Copy size={12} />}
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>

              {/* Content */}
              <div style={{ padding: "16px 20px" }}>
                {mode === "read" ? (
                  <div ref={readRef}>
                    <ReactMarkdown components={mdComponents} remarkPlugins={[remarkGfm]}>
                      {instructions}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <pre
                    style={{
                      background: "#FFFFFF",
                      border: "1px solid #EBF4DD",
                      borderRadius: 8,
                      padding: "12px 14px",
                      fontSize: 12,
                      lineHeight: 1.55,
                      color: "#3B4953",
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                      margin: 0,
                      fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                      overflowX: "auto",
                    }}
                  >
                    {instructions}
                  </pre>
                )}
              </div>
            </>
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
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

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
          maxHeight: "80vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          border: "1px solid #EBF4DD",
          boxShadow: "0px 12px 48px rgba(59, 73, 83, 0.16)",
        }}
      >
        {/* Header (pinned) */}
        <div
          className="flex items-center justify-between"
          style={{ padding: "16px 20px", borderBottom: "1px solid #EBF4DD", flexShrink: 0 }}
        >
          <div>
            <div className="flex items-center gap-2">
              <Zap size={15} style={{ color: "#547863" }} fill="#547863" />
              <div
                style={{
                  ...dmSerif,
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

        {/* Scrollable body */}
        <div
          className="flex-1 overflow-y-auto"
          style={{ padding: 20, display: "flex", flexDirection: "column", gap: 10, minHeight: 0 }}
        >
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
