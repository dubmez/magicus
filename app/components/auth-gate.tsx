"use client";

import { useEffect } from "react";
import { Sparkles, X } from "lucide-react";
import { GoogleLogin, type CredentialResponse } from "@react-oauth/google";
import { useAuth, type AuthUser } from "@/lib/auth-context";

const dmSerif = { fontFamily: "var(--font-dm-serif), serif", fontStyle: "italic" as const };

// Decode a JWT payload without verifying — we only need the profile claims to
// populate the UI. Google's library has already verified the token before
// handing it to us.
function decodeJwt(token: string): Record<string, unknown> | null {
  try {
    const payload = token.split(".")[1];
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function AuthGate() {
  const { gateOpen, closeGate, signIn, consumePendingAction } = useAuth();

  useEffect(() => {
    if (!gateOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") closeGate(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [gateOpen, closeGate]);

  if (!gateOpen) return null;

  const handleSuccess = (resp: CredentialResponse) => {
    if (!resp.credential) return;
    const claims = decodeJwt(resp.credential);
    if (!claims) return;
    const user: AuthUser = {
      id: String(claims.sub ?? ""),
      name: String(claims.name ?? "Friend"),
      email: String(claims.email ?? ""),
      avatarUrl: typeof claims.picture === "string" ? claims.picture : undefined,
    };
    signIn(user);
    const pending = consumePendingAction();
    closeGate();
    pending?.();
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

        <div
          className="flex items-center gap-2"
          style={{
            color: "#547863",
            fontSize: 12,
            letterSpacing: 0.6,
            marginBottom: 12,
          }}
        >
          <Sparkles size={14} />
          <span style={{ textTransform: "uppercase", fontWeight: 500 }}>
            Sign in to continue
          </span>
        </div>

        <h2
          style={{
            ...dmSerif,
            fontSize: 26,
            color: "#3B4953",
            lineHeight: 1.15,
            letterSpacing: -0.3,
            marginBottom: 8,
          }}
        >
          One step before the magic.
        </h2>
        <p
          style={{
            fontSize: 14,
            color: "#547863",
            lineHeight: 1.5,
            marginBottom: 24,
          }}
        >
          Magicus saves your workflows to your account so they&apos;re there when
          you come back. We only ever use your name and email — no posting, no
          scraping, no data sold.
        </p>

        <div className="flex justify-center">
          <GoogleLogin
            onSuccess={handleSuccess}
            onError={() => { /* noop — user can retry by clicking again */ }}
            theme="outline"
            size="large"
            text="continue_with"
            shape="pill"
          />
        </div>

        <div
          style={{
            marginTop: 18,
            fontSize: 11,
            color: "#90AB8B",
            textAlign: "center",
            lineHeight: 1.5,
          }}
        >
          By continuing you agree to use Magicus responsibly.
        </div>
      </div>
    </div>
  );
}
