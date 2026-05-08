import type { SupabaseClient } from "@supabase/supabase-js";

// Shape served to / accepted from the explainers table. The DB stores
// `evidence`, `how_to_use`, `tool_stack` as jsonb arrays; we type them
// strongly here so callers don't deal with `unknown`.

export type ExplainerStatus = "draft" | "published";

export type EvidenceItem = {
  screenshot_url: string | null;
  caption_title: string;
  caption_body: string;
};

export type HowToUseStep = {
  step_number: number;
  title: string;
  body: string;
};

export type ToolStackItem = {
  name: string;
  // Optional Clearbit / public logo URL — populated in Phase 3 when we
  // wire the logo lookup. Phase 1 leaves null and renders an initial.
  logo_url?: string | null;
};

export type Explainer = {
  id: string;
  user_id: string;
  token: string;
  status: ExplainerStatus;
  title: string | null;
  hook_headline: string | null;
  hook_body: string | null;
  evidence: EvidenceItem[];
  is_usable_by_others: boolean;
  how_to_use: HowToUseStep[];
  how_i_built_it_headline: string | null;
  how_i_built_it_body: string | null;
  trickiest_bit: string | null;
  tool_stack: ToolStackItem[];
  automation_platform: string | null;
  setup_time: string | null;
  trigger_type: string | null;
  why_i_built_it: string | null;
  used_since: string | null;
  use_count: number;
  view_count: number;
  build_count: number;
  narration_transcript: string | null;
  recording_url: string | null;
  created_at: string;
  updated_at: string;
};

// 8-char URL-safe token. nanoid-equivalent without the dep — uses
// crypto.getRandomValues over the same 64-char alphabet.
const TOKEN_ALPHABET =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_-";

export function generateExplainerToken(): string {
  const buf = new Uint8Array(8);
  // crypto exists in both browser and Node 19+; the API routes run on
  // Node 24 so this is safe everywhere we use it.
  crypto.getRandomValues(buf);
  let out = "";
  for (let i = 0; i < buf.length; i++) {
    out += TOKEN_ALPHABET[buf[i] % TOKEN_ALPHABET.length];
  }
  return out;
}

// Database row → typed Explainer. Pulls jsonb fields through with
// shallow casts; if the LLM ever emits something off-schema the caller
// downstream will surface it (we don't try to repair upstream errors
// here — it would mask real issues).
function rowToExplainer(row: Record<string, unknown>): Explainer {
  return {
    id: row.id as string,
    user_id: row.user_id as string,
    token: row.token as string,
    status: (row.status as ExplainerStatus) ?? "draft",
    title: (row.title as string | null) ?? null,
    hook_headline: (row.hook_headline as string | null) ?? null,
    hook_body: (row.hook_body as string | null) ?? null,
    evidence: Array.isArray(row.evidence) ? (row.evidence as EvidenceItem[]) : [],
    is_usable_by_others: !!row.is_usable_by_others,
    how_to_use: Array.isArray(row.how_to_use)
      ? (row.how_to_use as HowToUseStep[])
      : [],
    how_i_built_it_headline:
      (row.how_i_built_it_headline as string | null) ?? null,
    how_i_built_it_body: (row.how_i_built_it_body as string | null) ?? null,
    trickiest_bit: (row.trickiest_bit as string | null) ?? null,
    tool_stack: Array.isArray(row.tool_stack)
      ? (row.tool_stack as ToolStackItem[])
      : [],
    automation_platform:
      (row.automation_platform as string | null) ?? null,
    setup_time: (row.setup_time as string | null) ?? null,
    trigger_type: (row.trigger_type as string | null) ?? null,
    why_i_built_it: (row.why_i_built_it as string | null) ?? null,
    used_since: (row.used_since as string | null) ?? null,
    use_count: Number(row.use_count ?? 0),
    view_count: Number(row.view_count ?? 0),
    build_count: Number(row.build_count ?? 0),
    narration_transcript:
      (row.narration_transcript as string | null) ?? null,
    recording_url: (row.recording_url as string | null) ?? null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

const COLUMNS =
  "id, user_id, token, status, title, hook_headline, hook_body, evidence, is_usable_by_others, how_to_use, how_i_built_it_headline, how_i_built_it_body, trickiest_bit, tool_stack, automation_platform, setup_time, trigger_type, why_i_built_it, used_since, use_count, view_count, build_count, narration_transcript, recording_url, created_at, updated_at";

// ─── Reads ────────────────────────────────────────────────────────────────

export async function getExplainerById(
  client: SupabaseClient,
  id: string
): Promise<Explainer | null> {
  const { data, error } = await client
    .from("explainers")
    .select(COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToExplainer(data) : null;
}

export async function getExplainerByToken(
  client: SupabaseClient,
  token: string
): Promise<Explainer | null> {
  const { data, error } = await client
    .from("explainers")
    .select(COLUMNS)
    .eq("token", token)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToExplainer(data) : null;
}

// ─── Writes ───────────────────────────────────────────────────────────────

export type ExplainerDraftInput = {
  hook_headline?: string | null;
  hook_body?: string | null;
  evidence?: EvidenceItem[];
  is_usable_by_others?: boolean;
  how_to_use?: HowToUseStep[];
  how_i_built_it_headline?: string | null;
  how_i_built_it_body?: string | null;
  trickiest_bit?: string | null;
  tool_stack?: ToolStackItem[];
  automation_platform?: string | null;
  setup_time?: string | null;
  trigger_type?: string | null;
  why_i_built_it?: string | null;
  used_since?: string | null;
  narration_transcript?: string | null;
  recording_url?: string | null;
};

export async function createExplainerDraft(
  client: SupabaseClient,
  userId: string,
  draft: ExplainerDraftInput
): Promise<Explainer> {
  const token = generateExplainerToken();
  const { data, error } = await client
    .from("explainers")
    .insert({
      user_id: userId,
      token,
      status: "draft",
      ...draft,
    })
    .select(COLUMNS)
    .single();
  if (error) throw error;
  return rowToExplainer(data);
}

export async function updateExplainer(
  client: SupabaseClient,
  id: string,
  patch: ExplainerDraftInput
): Promise<Explainer> {
  const { data, error } = await client
    .from("explainers")
    .update(patch)
    .eq("id", id)
    .select(COLUMNS)
    .single();
  if (error) throw error;
  return rowToExplainer(data);
}

export async function publishExplainer(
  client: SupabaseClient,
  id: string
): Promise<Explainer> {
  const { data, error } = await client
    .from("explainers")
    .update({ status: "published" })
    .eq("id", id)
    .select(COLUMNS)
    .single();
  if (error) throw error;
  return rowToExplainer(data);
}

export async function bumpViewCount(
  client: SupabaseClient,
  token: string
): Promise<void> {
  const { error } = await client.rpc("bump_explainer_view_count", { t: token });
  if (error) throw error;
}

export async function bumpBuildCount(
  client: SupabaseClient,
  token: string
): Promise<void> {
  const { error } = await client.rpc("bump_explainer_build_count", { t: token });
  if (error) throw error;
}
