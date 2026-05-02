"use client";

import { GoogleOAuthProvider } from "@react-oauth/google";
import { AuthProvider } from "@/lib/auth-context";
import { AuthGate } from "./components/auth-gate";

const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

function MissingClientIdBanner() {
  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        background: "#FDECEC",
        color: "#8B2A2A",
        padding: "10px 16px",
        fontSize: 12,
        fontFamily: "var(--font-dm-sans), sans-serif",
        textAlign: "center",
        zIndex: 200,
        borderBottom: "1px solid #E5A8A8",
      }}
    >
      <strong>NEXT_PUBLIC_GOOGLE_CLIENT_ID is not set.</strong> Sign-in is
      disabled. Add it to <code>.env.local</code> and restart the dev server.
    </div>
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  if (!clientId) {
    // Render the app normally but show a banner. Auth-gated features will
    // still work; sign-in itself is the only thing that will fail.
    return (
      <AuthProvider>
        <MissingClientIdBanner />
        {children}
        <AuthGate />
      </AuthProvider>
    );
  }

  return (
    <GoogleOAuthProvider clientId={clientId}>
      <AuthProvider>
        {children}
        <AuthGate />
      </AuthProvider>
    </GoogleOAuthProvider>
  );
}
