"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

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
  signIn: (user: AuthUser) => void;
  signOut: () => void;
  // Gate state
  gateOpen: boolean;
  openGate: (pendingAction?: GateAction) => void;
  closeGate: () => void;
  consumePendingAction: () => GateAction;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const USER_KEY = "magicus:user";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [gateOpen, setGateOpen] = useState(false);
  const pendingActionRef = useRef<GateAction>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(USER_KEY);
      if (raw) setUser(JSON.parse(raw) as AuthUser);
    } catch {
      // localStorage unavailable or corrupt — treat as signed-out
    }
    setHydrated(true);
  }, []);

  const signIn = useCallback((u: AuthUser) => {
    setUser(u);
    try { localStorage.setItem(USER_KEY, JSON.stringify(u)); } catch {}
  }, []);

  const signOut = useCallback(() => {
    setUser(null);
    try { localStorage.removeItem(USER_KEY); } catch {}
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
      value={{ user, hydrated, signIn, signOut, gateOpen, openGate, closeGate, consumePendingAction }}
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
