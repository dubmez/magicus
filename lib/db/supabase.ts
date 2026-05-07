"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Workflow, Canvas, ShareSettings } from "./types";
import type { Storage } from "./storage";
import { supabaseBrowser } from "../supabase/client";

// Supabase-backed implementation of the Storage interface.
//
// Reads/writes go through the browser client which carries the user's
// auth cookie. RLS policies enforce ownership — even if a malicious
// caller tampered with this code, they couldn't read another user's
// rows (anon key + RLS is the security boundary).
//
// Operations that touch user-owned data require an authenticated user;
// the methods throw if there isn't one. Hooks should already gate on
// auth state, so this is belt-and-braces.
//
// Shape mapping:
//   workflows:  { id, user_id, data: jsonb }       <- whole Workflow object
//   canvases:   one row per canvas with split columns + jsonb arrays
//   shares:     one row per token, snapshot stored in jsonb columns

function client(): SupabaseClient {
  return supabaseBrowser() as unknown as SupabaseClient;
}

async function requireUserId(): Promise<string> {
  const { data, error } = await client().auth.getUser();
  if (error || !data.user) {
    throw new Error("Not authenticated");
  }
  return data.user.id;
}

// ─── Workflows ────────────────────────────────────────────────────────────

async function loadWorkflows(): Promise<Workflow[]> {
  const userId = await requireUserId();
  const { data, error } = await client()
    .from("workflows")
    .select("data")
    .eq("user_id", userId);
  if (error) throw error;
  return (data ?? []).map((row) => row.data as Workflow);
}

async function saveWorkflows(workflows: Workflow[]): Promise<void> {
  const userId = await requireUserId();

  // Upsert the current set, then delete anything no longer present. We
  // do upsert+delete (rather than a single transactional rewrite) so a
  // concurrent edit on another tab doesn't lose work — worst case is
  // a brief inconsistency, never destroyed data.
  if (workflows.length > 0) {
    const rows = workflows.map((w) => ({
      id: w.id,
      user_id: userId,
      data: w,
    }));
    const { error } = await client()
      .from("workflows")
      .upsert(rows, { onConflict: "user_id,id" });
    if (error) throw error;
  }

  const ids = workflows.map((w) => w.id);
  const stale = await client()
    .from("workflows")
    .select("id")
    .eq("user_id", userId);
  if (stale.error) throw stale.error;
  const toDelete = (stale.data ?? [])
    .map((r) => r.id as string)
    .filter((id) => !ids.includes(id));
  if (toDelete.length > 0) {
    const { error } = await client()
      .from("workflows")
      .delete()
      .eq("user_id", userId)
      .in("id", toDelete);
    if (error) throw error;
  }
}

// ─── Canvases ─────────────────────────────────────────────────────────────

type CanvasRow = {
  id: string;
  user_id: string;
  name: string;
  workflow_ids: string[];
  connections: Canvas["connections"];
  chain_names: Record<string, string>;
  read_only: boolean;
};

function rowToCanvas(row: CanvasRow): Canvas {
  return {
    id: row.id,
    name: row.name,
    workflowIds: row.workflow_ids,
    connections: row.connections,
    chainNames: row.chain_names,
    readOnly: row.read_only,
  };
}

async function loadCanvases(): Promise<Canvas[]> {
  const userId = await requireUserId();
  const { data, error } = await client()
    .from("canvases")
    .select("id, user_id, name, workflow_ids, connections, chain_names, read_only")
    .eq("user_id", userId);
  if (error) throw error;
  return (data ?? []).map((row) => rowToCanvas(row as CanvasRow));
}

async function saveCanvases(canvases: Canvas[]): Promise<void> {
  const userId = await requireUserId();
  // Skip read-only canvases — the Library is a client-side seed, never
  // persisted server-side. Each user reconstructs it locally.
  const writable = canvases.filter((c) => !c.readOnly);

  if (writable.length > 0) {
    const rows = writable.map((c) => ({
      id: c.id,
      user_id: userId,
      name: c.name,
      workflow_ids: c.workflowIds,
      connections: c.connections,
      chain_names: c.chainNames,
      read_only: false,
    }));
    const { error } = await client()
      .from("canvases")
      .upsert(rows, { onConflict: "user_id,id" });
    if (error) throw error;
  }

  // Remove server-side rows the client no longer has.
  const ids = writable.map((c) => c.id);
  const stale = await client()
    .from("canvases")
    .select("id")
    .eq("user_id", userId);
  if (stale.error) throw stale.error;
  const toDelete = (stale.data ?? [])
    .map((r) => r.id as string)
    .filter((id) => !ids.includes(id));
  if (toDelete.length > 0) {
    const { error } = await client()
      .from("canvases")
      .delete()
      .eq("user_id", userId)
      .in("id", toDelete);
    if (error) throw error;
  }
}

// Active canvas id is per-user-device state; we still keep it client-side
// in localStorage. A user's "current view" doesn't need to sync across
// devices — they probably want different focus on phone vs laptop.
const ACTIVE_KEY = "magicus:active-canvas";

async function loadActiveCanvasId(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(ACTIVE_KEY);
  } catch {
    return null;
  }
}

async function saveActiveCanvasId(id: string): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(ACTIVE_KEY, id);
  } catch {
    /* drop write on quota / disabled storage */
  }
}

// ─── Shares ───────────────────────────────────────────────────────────────

type ShareRow = {
  token: string;
  user_id: string;
  workflow_data: Workflow;
  redactions: ShareSettings["redactions"];
  shared_by: ShareSettings["sharedBy"];
  public_library: boolean;
  remix_count: number;
  created_at: string;
};

function rowToShare(row: ShareRow): ShareSettings {
  return {
    token: row.token,
    workflow: row.workflow_data,
    sharedBy: row.shared_by,
    redactions: row.redactions,
    publicLibrary: row.public_library,
    remixCount: row.remix_count,
    createdAt: new Date(row.created_at).getTime(),
  };
}

async function loadShare(token: string): Promise<ShareSettings | null> {
  // Anyone (incl. anon) can read shares by token — RLS allows it.
  const { data, error } = await client()
    .from("shares")
    .select("token, user_id, workflow_data, redactions, shared_by, public_library, remix_count, created_at")
    .eq("token", token)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToShare(data as ShareRow) : null;
}

async function loadSharesByWorkflowId(workflowId: string): Promise<ShareSettings[]> {
  // Filter via jsonb path on the snapshot. Could add a dedicated column +
  // index if this gets hot, but for now the per-user share count is small.
  const userId = await requireUserId();
  const { data, error } = await client()
    .from("shares")
    .select("token, user_id, workflow_data, redactions, shared_by, public_library, remix_count, created_at")
    .eq("user_id", userId)
    .eq("workflow_data->>id", workflowId);
  if (error) throw error;
  return (data ?? []).map((r) => rowToShare(r as ShareRow));
}

async function saveShare(settings: ShareSettings): Promise<void> {
  const userId = await requireUserId();
  const row = {
    token: settings.token,
    user_id: userId,
    workflow_data: settings.workflow,
    redactions: settings.redactions,
    shared_by: settings.sharedBy,
    public_library: settings.publicLibrary,
    remix_count: settings.remixCount,
  };
  const { error } = await client()
    .from("shares")
    .upsert(row, { onConflict: "token" });
  if (error) throw error;
}

async function incrementRemixCount(token: string): Promise<void> {
  // Anonymous remixers can't UPDATE shares directly (RLS blocks them).
  // We route through the security-definer RPC that only changes
  // remix_count.
  const { error } = await client().rpc("bump_remix_count", { share_token: token });
  if (error) throw error;
}

export const supabaseBackend: Storage = {
  loadWorkflows,
  saveWorkflows,
  loadCanvases,
  saveCanvases,
  loadActiveCanvasId,
  saveActiveCanvasId,
  loadShare,
  loadSharesByWorkflowId,
  saveShare,
  incrementRemixCount,
};
