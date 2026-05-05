"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type { Session, User as SupabaseUser } from "@supabase/supabase-js";
import { supabaseBrowser } from "@/lib/supabase/client";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
};

type GateAction = (() => void) | null;

type AuthContextValue = {
  user: AuthUser | null;
  hydrated: boolean;
  // Triggers the Google OAuth flow via Supabase. Resolves once the redirect
  // is initiated; the actual sign-in completes when the browser comes back
  // from /auth/callback.
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  // Gate state
  gateOpen: boolean;
  openGate: (pendingAction?: GateAction) => void;
  closeGate: () => void;
  consumePendingAction: () => GateAction;
};

const AuthContext = createContext<AuthContextValue | null>(null);

// Pre-Supabase auth stored the user under this key. We clear it on first
// load post-migration so stale data doesn't sit around forever; nothing
// reads from it anymore.
const LEGACY_USER_KEY = "magicus:user";

function supabaseUserToAuthUser(u: SupabaseUser): AuthUser {
  const meta = (u.user_metadata ?? {}) as Record<string, unknown>;
  const name =
    (typeof meta.full_name === "string" && meta.full_name) ||
    (typeof meta.name === "string" && meta.name) ||
    (u.email ? u.email.split("@")[0] : "Friend");
  const avatarUrl =
    typeof meta.avatar_url === "string" ? meta.avatar_url : undefined;
  return {
    id: u.id,
    name,
    email: u.email ?? "",
    avatarUrl,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [gateOpen, setGateOpen] = useState(false);
  const pendingActionRef = useRef<GateAction>(null);

  useEffect(() => {
    // One-shot cleanup of the pre-migration localStorage key. Idempotent
    // and cheap; once the codebase ages enough that everyone's been on
    // Supabase for a while, this can come out.
    try { localStorage.removeItem(LEGACY_USER_KEY); } catch { /* ignore */ }

    let cancelled = false;
    const sb = supabaseBrowser();
    void sb.auth.getSession().then(({ data }: { data: { session: Session | null } }) => {
      if (cancelled) return;
      if (data.session) setUser(supabaseUserToAuthUser(data.session.user));
      setHydrated(true);
    });
    const { data: sub } = sb.auth.onAuthStateChange(
      (_evt: string, session: Session | null) => {
        setUser(session ? supabaseUserToAuthUser(session.user) : null);
      }
    );
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signInWithGoogle = useCallback(async () => {
    const sb = supabaseBrowser();
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    // We bounce through our own /auth/callback so the server-side cookie
    // sync runs before the user lands on the canvas.
    const { error } = await sb.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${origin}/auth/callback` },
    });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    const sb = supabaseBrowser();
    await sb.auth.signOut();
  }, []);

  const openGate = useCallback((pendingAction?: GateAction) => {
    pendingActionRef.current = pendingAction ?? null;
    setGateOpen(true);
  }, []);

  const closeGate = useCallback(() => {
    pendingActionRef.current = null;
    setGateOpen(false);
  }, []);

  const consumePendingAction = useCallback(() => {
    const a = pendingActionRef.current;
    pendingActionRef.current = null;
    return a;
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        hydrated,
        signInWithGoogle,
        signOut,
        gateOpen,
        openGate,
        closeGate,
        consumePendingAction,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

// Wraps an action so it only runs when the user is signed in. If unauthenticated,
// opens the auth gate and queues the action to replay after successful sign-in.
export function useRequireAuth() {
  const { user, openGate } = useAuth();
  return useCallback(
    (action: () => void) => {
      if (user) action();
      else openGate(action);
    },
    [user, openGate]
  );
}
