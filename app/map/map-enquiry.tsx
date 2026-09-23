"use client";

import { useEffect, useState } from "react";
import { C, SANS, SERIF, button } from "./theme";

// "Map it in your audit", for a friction we have not mapped for the demo. The
// same enquiry the agents' "Book your audit" sends (/agents/enquiry, which
// magicus.io forwards), carrying the friction so whoever replies knows what to map.

type State = "idle" | "sending" | "sent" | "error";

export function MapEnquiry({ friction, onClose }: { friction: string; onClose: () => void }) {
  const [state, setState] = useState<State>("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState("sending");
    const data = Object.fromEntries(new FormData(e.currentTarget));
    try {
      const res = await fetch("/agents/enquiry", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...data, friction }),
      });
      const json = (await res.json()) as { ok: boolean; error?: string };
      if (json.ok) setState("sent");
      else {
        setError(json.error ?? "That did not send.");
        setState("error");
      }
    } catch {
      setError("That did not send. Check your connection and try again.");
      setState("error");
    }
  }

  const field = {
    width: "100%",
    height: 44,
    padding: "0 12px",
    borderRadius: 8,
    border: `1px solid ${C.rule}`,
    fontFamily: SANS,
    fontSize: 15,
    color: C.ink,
    background: C.white,
  } as const;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Map it in your audit"
      onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(59, 73, 83, 0.35)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: "100%", maxWidth: 460, background: C.white, borderRadius: 16, padding: 28, fontFamily: SANS, color: C.ink, boxShadow: "0 24px 64px rgba(59, 73, 83, 0.25)" }}
      >
        {state === "sent" ? (
          <>
            <h2 style={{ fontFamily: SERIF, fontWeight: 400, fontSize: 28, margin: "0 0 8px" }}>Thanks. We&apos;ll be in touch.</h2>
            <p style={{ fontSize: 15, color: C.sage, margin: "0 0 24px" }}>We&apos;ll map this one with you in the audit.</p>
            <button type="button" onClick={onClose} style={button.primary}>
              Back to the demo
            </button>
          </>
        ) : (
          <form onSubmit={submit}>
            <h2 style={{ fontFamily: SERIF, fontWeight: 400, fontSize: 28, margin: "0 0 8px" }}>Map it in your audit</h2>
            <p style={{ fontSize: 15, color: C.sage, lineHeight: 1.5, margin: "0 0 20px" }}>
              &ldquo;{friction}&rdquo; We map this one with your team, from how it really runs, then show where the value is.
            </p>
            <div style={{ display: "grid", gap: 10, marginBottom: 16 }}>
              <input name="name" required placeholder="Your name" aria-label="Your name" style={field} />
              <input name="email" type="email" required placeholder="Work email" aria-label="Work email" style={field} />
              <input name="company" placeholder="Company" aria-label="Company" style={field} />
              {/* People never see this; anything that fills it in is not a person. */}
              <input name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" style={{ position: "absolute", left: -9999 }} />
            </div>
            {state === "error" ? <p style={{ fontSize: 13, color: C.coral, margin: "0 0 12px" }}>{error}</p> : null}
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <button type="submit" disabled={state === "sending"} style={button.primary}>
                {state === "sending" ? "Sending…" : "Send"}
              </button>
              <button type="button" onClick={onClose} style={button.quiet}>
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
