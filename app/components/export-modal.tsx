"use client";

import { useEffect, useState } from "react";
import { X, Copy, Check } from "lucide-react";

export function ExportModal({
  open,
  title,
  markdown,
  onClose,
}: {
  open: boolean;
  title: string;
  markdown: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Lock body scroll so the page doesn't drift behind the dimmed backdrop.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  if (!open) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(markdown);
    } catch {}
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

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
          width: "min(800px, 100%)",
          maxHeight: "85vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          border: "1px solid #EBF4DD",
        }}
      >
        <div
          className="flex items-center justify-between"
          style={{ padding: "16px 20px", borderBottom: "1px solid #EBF4DD" }}
        >
          <div>
            <div
              style={{
                fontFamily: "var(--font-dm-serif), serif",
                fontStyle: "italic",
                fontSize: 18,
                color: "#3B4953",
              }}
            >
              {title}
            </div>
            <div style={{ fontSize: 12, color: "#547863", marginTop: 2 }}>
              Markdown — ready for Claude Routines or n8n
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={copy}
              className="flex items-center gap-2 hover:opacity-90 transition-opacity"
              style={{
                background: "#3B4953",
                color: "#EBF4DD",
                padding: "8px 14px",
                borderRadius: 999,
                fontSize: 13,
                fontWeight: 500,
              }}
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? "Copied" : "Copy markdown"}
            </button>
            <button
              onClick={onClose}
              className="hover:bg-[#EBF4DD] rounded-md p-2"
              style={{ color: "#547863" }}
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto" style={{ background: "#F7FAF2", padding: 20 }}>
          <pre
            style={{
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              fontSize: 12,
              color: "#3B4953",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              margin: 0,
              lineHeight: 1.55,
            }}
          >
            {markdown}
          </pre>
        </div>
      </div>
    </div>
  );
}
