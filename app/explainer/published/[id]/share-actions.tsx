"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";

const CORAL = "#E66B4D";
const INK = "#3B4953";
const SAGE = "#547863";
const SAGE_MUTED = "#90AB8B";
const CARD_BORDER = "#EBF4DD";

// Copy-link input + LinkedIn share. Lives client-side because both
// actions need browser APIs (clipboard / window.open).
export function ShareScreenActions({
  token,
  hookHeadline,
}: {
  token: string;
  hookHeadline: string;
}) {
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Origin is only known on the client — building the absolute URL
  // server-side would require a request header round-trip we don't
  // need for this surface.
  useEffect(() => {
    if (typeof window !== "undefined") setOrigin(window.location.origin);
  }, []);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const url = origin ? `${origin}/e/${token}` : `magicus.io/e/${token}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard refused — leave UI unchanged */
    }
  };

  return (
    <div className="flex flex-col gap-3" style={{ alignItems: "stretch" }}>
      <div
        className="flex items-center gap-2"
        style={{
          background: "#FFFFFF",
          border: `1px solid ${CARD_BORDER}`,
          borderRadius: 12,
          padding: "10px 12px 10px 16px",
        }}
      >
        <input
          readOnly
          value={url}
          aria-label="Public explainer URL"
          style={{
            flex: 1,
            background: "transparent",
            border: "none",
            outline: "none",
            fontSize: 14,
            color: INK,
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
          }}
          onFocus={(e) => e.currentTarget.select()}
        />
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 transition-colors hover:bg-[#EBF4DD]"
          aria-label="Copy link"
          style={{
            background: copied ? "#EBF4DD" : "transparent",
            color: SAGE,
            border: "none",
            padding: "6px 12px",
            borderRadius: 999,
            fontSize: 12,
            fontWeight: 500,
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? "Copied" : "Copy link"}
        </button>
      </div>

      {origin && (
        <a
          href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`}
          target="_blank"
          rel="noreferrer"
          className="hover:opacity-90 transition-opacity"
          style={{
            background: CORAL,
            color: "#FFFFFF",
            padding: "11px 18px",
            borderRadius: 999,
            fontSize: 14,
            fontWeight: 500,
            textDecoration: "none",
            textAlign: "center",
          }}
        >
          Share to LinkedIn →
        </a>
      )}

      <p style={{ fontSize: 11, color: SAGE_MUTED, marginTop: 2 }}>
        {hookHeadline.length > 60 ? `${hookHeadline.slice(0, 57)}…` : hookHeadline}
      </p>
    </div>
  );
}
