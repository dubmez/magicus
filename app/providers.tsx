"use client";

import { AuthProvider } from "@/lib/auth-context";
import { AuthGate } from "./components/auth-gate";

// Auth used to be Google's @react-oauth/google library wrapped here; now
// it lives entirely inside AuthProvider via Supabase. Provider tree stays
// minimal — the gate modal renders alongside the rest of the app.

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      {children}
      <AuthGate />
    </AuthProvider>
  );
}
