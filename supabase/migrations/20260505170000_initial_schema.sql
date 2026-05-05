-- Initial schema for Magicus.
--
-- Four tables (profiles, canvases, workflows, shares) plus the helper
-- function and triggers needed to make them work.
--
-- Design principles:
--   * Switchability — plain SQL, portable to any Postgres. No Supabase-only
--     types or extensions outside of `auth.uid()` and the auth schema, both
--     trivially shimmable on Neon/RDS by replacing the policies.
--   * Security — RLS enabled on every public table; users only ever see
--     their own canvases/workflows/profiles. Shares are public-readable by
--     token (the token IS the auth) but writable only by the owner.
--     Anonymous remix counting goes through a security-definer function so
--     no one can directly UPDATE other columns of `shares`.
--   * Versioning — each migration is one numbered file. Re-running this
--     against an existing schema is safe: every CREATE uses IF NOT EXISTS
--     and policies are dropped+recreated to allow tweaks.

-- ─── PROFILES ─────────────────────────────────────────────────────────────
-- Extends auth.users with display_name + avatar_url. Auto-created on
-- signup via the trigger at the bottom of this file.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  avatar_url text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "users read own profile" on public.profiles;
create policy "users read own profile"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "users update own profile" on public.profiles;
create policy "users update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- INSERT is handled by the auto-create trigger below; no policy needed
-- for direct INSERTs. DELETE cascades from auth.users — no policy needed.

-- ─── CANVASES ─────────────────────────────────────────────────────────────
-- Each user has a small number of canvases (typically 2-3). Composite
-- PK lets us keep client-friendly text ids like "canvas-default" without
-- collisions across users.

create table if not exists public.canvases (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  workflow_ids jsonb not null default '[]'::jsonb,
  connections  jsonb not null default '[]'::jsonb,
  chain_names  jsonb not null default '{}'::jsonb,
  read_only boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

alter table public.canvases enable row level security;

drop policy if exists "users read own canvases"   on public.canvases;
drop policy if exists "users insert own canvases" on public.canvases;
drop policy if exists "users update own canvases" on public.canvases;
drop policy if exists "users delete own canvases" on public.canvases;

create policy "users read own canvases"
  on public.canvases for select
  using (auth.uid() = user_id);

create policy "users insert own canvases"
  on public.canvases for insert
  with check (auth.uid() = user_id);

create policy "users update own canvases"
  on public.canvases for update
  using (auth.uid() = user_id);

create policy "users delete own canvases"
  on public.canvases for delete
  using (auth.uid() = user_id);

-- ─── WORKFLOWS ────────────────────────────────────────────────────────────
-- Whole-object jsonb storage. Schema-on-read keeps us nimble while the
-- Workflow shape is still evolving (steps, classifications, etc.). When
-- we need to query inside the json, postgres' jsonb operators do the job.

create table if not exists public.workflows (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

alter table public.workflows enable row level security;

drop policy if exists "users read own workflows"   on public.workflows;
drop policy if exists "users insert own workflows" on public.workflows;
drop policy if exists "users update own workflows" on public.workflows;
drop policy if exists "users delete own workflows" on public.workflows;

create policy "users read own workflows"
  on public.workflows for select
  using (auth.uid() = user_id);

create policy "users insert own workflows"
  on public.workflows for insert
  with check (auth.uid() = user_id);

create policy "users update own workflows"
  on public.workflows for update
  using (auth.uid() = user_id);

create policy "users delete own workflows"
  on public.workflows for delete
  using (auth.uid() = user_id);

-- ─── SHARES ───────────────────────────────────────────────────────────────
-- Public-readable by token (anyone with the URL can view the snapshot).
-- Writes restricted to the owner. Remix counting uses a security-definer
-- function so anonymous remixers can bump the counter without being
-- granted UPDATE on the table.

create table if not exists public.shares (
  token text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  workflow_data jsonb not null,
  redactions    jsonb not null,
  shared_by     jsonb not null,
  public_library boolean not null default false,
  remix_count integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists shares_user_id_idx on public.shares(user_id);

alter table public.shares enable row level security;

drop policy if exists "shares are publicly readable" on public.shares;
drop policy if exists "users insert own shares"      on public.shares;
drop policy if exists "users update own shares"      on public.shares;
drop policy if exists "users delete own shares"      on public.shares;

create policy "shares are publicly readable"
  on public.shares for select
  using (true);

create policy "users insert own shares"
  on public.shares for insert
  with check (auth.uid() = user_id);

create policy "users update own shares"
  on public.shares for update
  using (auth.uid() = user_id);

create policy "users delete own shares"
  on public.shares for delete
  using (auth.uid() = user_id);

-- ─── HELPER FUNCTIONS ─────────────────────────────────────────────────────

-- Bumps the remix counter on a share. Security-definer means anonymous
-- callers can execute it even though the table's UPDATE policy restricts
-- direct updates to the owner. Locked search_path prevents an attacker
-- from shadowing public.shares to redirect the update.
create or replace function public.bump_remix_count(share_token text)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  update public.shares
  set remix_count = remix_count + 1
  where token = share_token;
end;
$$;

revoke all on function public.bump_remix_count(text) from public;
grant execute on function public.bump_remix_count(text) to anon, authenticated;

-- Updated-at trigger function — touches `updated_at` on every UPDATE.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists canvases_set_updated_at  on public.canvases;
drop trigger if exists workflows_set_updated_at on public.workflows;

create trigger canvases_set_updated_at
  before update on public.canvases
  for each row execute function public.set_updated_at();

create trigger workflows_set_updated_at
  before update on public.workflows
  for each row execute function public.set_updated_at();

-- Auto-create a profile row when a new auth user signs up. Pulls
-- display_name + avatar_url from the OAuth provider's metadata where
-- available; falls back to the email local-part for display_name.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'name',
      new.raw_user_meta_data->>'full_name',
      split_part(new.email, '@', 1)
    ),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
