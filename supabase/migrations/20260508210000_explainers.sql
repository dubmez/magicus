-- Explainers — a shareable artefact format for go-to people who already
-- built an automation and want to walk others through it. Distinct from
-- `shares` (which snapshot a workflow card): an explainer is a richer
-- generated post — hook, evidence, "how I built it", recipe-card stats —
-- produced from a narrated screen recording.
--
-- Public readability is by token (the token IS the auth, same model as
-- `shares`). Drafts are creator-only until status flips to 'published'.

create table if not exists public.explainers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- nanoid(8) generated client-side at creation. Token-based public read
  -- means we never want this to collide; an 8-char nanoid gives ~2.8e14
  -- combinations which is plenty for this surface.
  token text not null unique,
  status text not null default 'draft',  -- 'draft' | 'published'

  -- Hook
  title text,
  hook_headline text,
  hook_body text,

  -- Evidence — array of { screenshot_url?, caption_title, caption_body }.
  -- Phase 1 stores caption text only; screenshots arrive in Phase 2/3
  -- alongside the manual upload UI / video keyframe extraction.
  evidence jsonb not null default '[]'::jsonb,

  -- How to use it (optional public section)
  is_usable_by_others boolean not null default false,
  -- Array of { step_number, title, body }
  how_to_use jsonb not null default '[]'::jsonb,

  -- How I built it
  how_i_built_it_headline text,
  how_i_built_it_body text,
  trickiest_bit text,
  -- Array of { name, logo_url? }
  tool_stack jsonb not null default '[]'::jsonb,

  -- At-a-glance recipe card
  automation_platform text,
  setup_time text,
  trigger_type text,        -- 'event-based' | 'scheduled' | 'manual'
  why_i_built_it text,
  used_since text,

  -- Engagement counters. view_count is bumped via a security-definer
  -- function so anonymous viewers can increment without being granted
  -- update on the row.
  use_count integer not null default 0,
  view_count integer not null default 0,
  build_count integer not null default 0,

  -- Source artefacts kept for re-generation / debugging
  narration_transcript text,
  recording_url text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists explainers_user_id_idx on public.explainers(user_id);
create index if not exists explainers_token_idx on public.explainers(token);

alter table public.explainers enable row level security;

drop policy if exists "owner reads own explainers"        on public.explainers;
drop policy if exists "published explainers are public"   on public.explainers;
drop policy if exists "owner inserts own explainers"      on public.explainers;
drop policy if exists "owner updates own explainers"      on public.explainers;
drop policy if exists "owner deletes own explainers"      on public.explainers;

-- Two SELECT policies (RLS unions them): the owner sees all of theirs,
-- everyone else can only see published rows.
create policy "owner reads own explainers"
  on public.explainers for select
  using (auth.uid() = user_id);

create policy "published explainers are public"
  on public.explainers for select
  using (status = 'published');

create policy "owner inserts own explainers"
  on public.explainers for insert
  with check (auth.uid() = user_id);

create policy "owner updates own explainers"
  on public.explainers for update
  using (auth.uid() = user_id);

create policy "owner deletes own explainers"
  on public.explainers for delete
  using (auth.uid() = user_id);

-- View counter — anon-callable RPC so a public viewer can bump it
-- without being granted UPDATE on the row. Locked search_path keeps
-- a hostile schema from redirecting the update.
create or replace function public.bump_explainer_view_count(t text)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  update public.explainers
  set view_count = view_count + 1
  where token = t and status = 'published';
end;
$$;

revoke all on function public.bump_explainer_view_count(text) from public;
grant execute on function public.bump_explainer_view_count(text) to anon, authenticated;

-- Build-counter RPC. Authenticated only — clicking "Build something
-- like this" is an authed action so we can RLS this normally if we
-- ever expose direct UPDATE; for now keep parity with view-bump.
create or replace function public.bump_explainer_build_count(t text)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  update public.explainers
  set build_count = build_count + 1
  where token = t and status = 'published';
end;
$$;

revoke all on function public.bump_explainer_build_count(text) from public;
grant execute on function public.bump_explainer_build_count(text) to authenticated;

-- Updated-at trigger — same set_updated_at function from the initial
-- schema. Drop+recreate the trigger only.
drop trigger if exists explainers_set_updated_at on public.explainers;
create trigger explainers_set_updated_at
  before update on public.explainers
  for each row execute function public.set_updated_at();

-- ─── STORAGE: explainer-evidence bucket ──────────────────────────────────
-- Public-read bucket for evidence screenshots. The screenshots are
-- referenced from the public explainer page so they need to be
-- world-readable. Writes are restricted to the owning user, scoped by
-- the path prefix `{user_id}/...`.

insert into storage.buckets (id, name, public)
values ('explainer-evidence', 'explainer-evidence', true)
on conflict (id) do nothing;

drop policy if exists "evidence is publicly readable"      on storage.objects;
drop policy if exists "owner uploads evidence to own path" on storage.objects;
drop policy if exists "owner updates own evidence"         on storage.objects;
drop policy if exists "owner deletes own evidence"         on storage.objects;

create policy "evidence is publicly readable"
  on storage.objects for select
  using (bucket_id = 'explainer-evidence');

create policy "owner uploads evidence to own path"
  on storage.objects for insert
  with check (
    bucket_id = 'explainer-evidence'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "owner updates own evidence"
  on storage.objects for update
  using (
    bucket_id = 'explainer-evidence'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "owner deletes own evidence"
  on storage.objects for delete
  using (
    bucket_id = 'explainer-evidence'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
