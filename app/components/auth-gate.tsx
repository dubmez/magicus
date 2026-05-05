"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

const dmSerif = { fontFamily: "var(--font-dm-serif), serif", fontStyle: "italic" as const };

export function AuthGate() {
  const { gateOpen, closeGate, signInWithGoogle } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!gateOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") closeGate(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [gateOpen, closeGate]);

  // Lock body scroll while the gate is open so the page underneath can't
  // shift around behind the dimmed backdrop.
  useEffect(() => {
    if (!gateOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [gateOpen]);

  if (!gateOpen) return null;

  const handleSignIn = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      // signInWithGoogle redirects the browser, so this promise typically
      // resolves _during_ the navigation — we won't run the success
      // handler. Errors before the redirect (popup blocked, network) come
      // back here.
      await signInWithGoogle();
    } catch (err) {
      setBusy(false);
      setError(err instanceof Error ? err.message : "Sign-in failed.");
    }
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{
        background: "rgba(59, 73, 83, 0.4)",
        zIndex: 110,
        padding: 24,
        fontFamily: "var(--font-dm-sans), sans-serif",
      }}
      onClick={closeGate}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(440px, 100%)",
          background: "#FFFFFF",
          borderRadius: 20,
          border: "1px solid #EBF4DD",
          padding: "36px 36px 32px",
          position: "relative",
          boxShadow: "0px 12px 48px rgba(59, 73, 83, 0.18)",
        }}
      >
        <button
          onClick={closeGate}
          className="absolute hover:bg-[#EBF4DD] rounded-md p-2"
          style={{ top: 12, right: 12, color: "#547863" }}
          aria-label="Close"
        >
          <X size={16} />
        </button>

        <h2
          style={{
            ...dmSerif,
            fontSize: 26,
            color: "#3B4953",
            lineHeight: 1.2,
            letterSpacing: -0.3,
            marginBottom: 10,
          }}
        >
          One last thing before the magic happens
        </h2>
        <p
          style={{
            fontSize: 14,
            color: "#547863",
            lineHeight: 1.5,
            marginBottom: 24,
          }}
        >
          Sign in to save your workflows and access your canvas.
        </p>

        <button
          onClick={handleSignIn}
          disabled={busy}
          className="w-full hover:bg-[#F7FAF2] transition-colors flex items-center justify-center gap-3"
          style={{
            background: "#FFFFFF",
            color: "#3B4953",
            border: "1px solid #DBE3D5",
            padding: "12px 16px",
            borderRadius: 999,
            fontSize: 14,
            fontWeight: 500,
            cursor: busy ? "wait" : "pointer",
            opacity: busy ? 0.6 : 1,
          }}
        >
          <GoogleGlyph />
          {busy ? "Redirecting…" : "Continue with Google"}
        </button>

        {error && (
          <div
            style={{
              marginTop: 12,
              fontSize: 12,
              color: "#8B2A2A",
              background: "#FDECEC",
              border: "1px solid #E5A8A8",
              borderRadius: 8,
              padding: "8px 12px",
              lineHeight: 1.4,
            }}
          >
            {error}
          </div>
        )}

        <div
          style={{
            marginTop: 18,
            fontSize: 11,
            color: "#90AB8B",
            textAlign: "center",
            lineHeight: 1.5,
          }}
        >
          No password needed. We&apos;ll never post without your permission.
        </div>
      </div>
    </div>
  );
}

// Inline SVG so the button matches the visual weight of the rest of the
// modal without pulling in an icon dependency.
function GoogleGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden focusable="false">
      <path d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.49h4.84a4.14 4.14 0 0 1-1.79 2.71v2.26h2.9c1.7-1.56 2.69-3.87 2.69-6.62z" fill="#4285F4" />
      <path d="M9 18c2.43 0 4.47-.81 5.96-2.18l-2.9-2.26c-.8.54-1.83.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.96v2.34A8.997 8.997 0 0 0 9 18z" fill="#34A853" />
      <path d="M3.95 10.7c-.18-.54-.28-1.12-.28-1.7s.1-1.16.28-1.7V4.96H.96a8.996 8.996 0 0 0 0 8.08l2.99-2.34z" fill="#FBBC05" />
      <path d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A8.997 8.997 0 0 0 .96 4.96l2.99 2.34C4.66 5.17 6.65 3.58 9 3.58z" fill="#EA4335" />
    </svg>
  );
}
