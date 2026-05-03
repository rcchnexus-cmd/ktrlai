-- KtrlAI Phase 1 Supabase backend foundation
-- Run this in the Supabase SQL editor for a new project.
-- Frontend code must use only VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.

create extension if not exists "pgcrypto";

create type public.workspace_role as enum ('owner', 'admin', 'member', 'viewer');
create type public.domain_status as enum ('pending', 'verified', 'disabled');
create type public.activity_status as enum ('allowed', 'blocked', 'restricted', 'paid_access', 'summaries_only');
create type public.visibility_provider as enum ('chatgpt', 'perplexity', 'claude', 'google_ai', 'other');
create type public.access_decision as enum ('allow_full', 'allow_summary', 'paid_access_required', 'training_denied', 'block_all');
create type public.privacy_level as enum ('public', 'restricted', 'private');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text not null unique,
  avatar_url text,
  plan text not null default 'Free',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  plan text not null default 'Free',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.workspace_role not null default 'member',
  created_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);

create table public.domains (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  hostname text not null,
  status public.domain_status not null default 'pending',
  verification_token text not null default encode(gen_random_bytes(16), 'hex'),
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, hostname)
);

create table public.api_keys (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null default 'Default key',
  key_prefix text not null,
  key_hash text not null,
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  unique (workspace_id, key_prefix)
);

create table public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  domain_id uuid references public.domains(id) on delete set null,
  bot_name text not null,
  bot_type text not null,
  page_path text not null,
  status public.activity_status not null,
  tokens_used integer not null default 0,
  region text,
  user_agent text,
  ip_hash text,
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create table public.visibility_checks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  domain_id uuid references public.domains(id) on delete set null,
  provider public.visibility_provider not null,
  status text not null,
  score integer not null check (score between 0 and 100),
  suggested_queries text[] not null default '{}',
  details jsonb not null default '{}'::jsonb,
  checked_at timestamptz not null default now()
);

create table public.control_rules (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  domain_id uuid references public.domains(id) on delete cascade,
  name text not null,
  bot_match text not null default '*',
  decision public.access_decision not null,
  is_enabled boolean not null default true,
  conditions jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.monetization_settings (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  paid_access_enabled boolean not null default false,
  price_per_crawl numeric(10, 2) not null default 0,
  price_per_dataset_usage numeric(12, 2) not null default 0,
  estimated_monthly_earnings numeric(12, 2) not null default 0,
  currency text not null default 'USD',
  updated_at timestamptz not null default now(),
  unique (workspace_id)
);

create table public.training_permissions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  train_on_data boolean not null default false,
  allow_writing_style boolean not null default false,
  dataset_licensing boolean not null default false,
  personalization_models boolean not null default false,
  privacy_level public.privacy_level not null default 'restricted',
  allowed_sources text[] not null default '{}',
  updated_at timestamptz not null default now(),
  unique (workspace_id)
);

create index activity_logs_workspace_occurred_idx on public.activity_logs (workspace_id, occurred_at desc);
create index activity_logs_domain_idx on public.activity_logs (domain_id);
create index visibility_checks_workspace_checked_idx on public.visibility_checks (workspace_id, checked_at desc);
create index control_rules_workspace_enabled_idx on public.control_rules (workspace_id, is_enabled);
create index domains_workspace_status_idx on public.domains (workspace_id, status);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger workspaces_set_updated_at
before update on public.workspaces
for each row execute function public.set_updated_at();

create trigger domains_set_updated_at
before update on public.domains
for each row execute function public.set_updated_at();

create trigger control_rules_set_updated_at
before update on public.control_rules
for each row execute function public.set_updated_at();

create trigger monetization_settings_set_updated_at
before update on public.monetization_settings
for each row execute function public.set_updated_at();

create trigger training_permissions_set_updated_at
before update on public.training_permissions
for each row execute function public.set_updated_at();

create or replace function public.is_workspace_member(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = target_workspace_id
      and wm.user_id = auth.uid()
  );
$$;

create or replace function public.has_workspace_role(target_workspace_id uuid, allowed_roles public.workspace_role[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = target_workspace_id
      and wm.user_id = auth.uid()
      and wm.role = any(allowed_roles)
  );
$$;

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.domains enable row level security;
alter table public.api_keys enable row level security;
alter table public.activity_logs enable row level security;
alter table public.visibility_checks enable row level security;
alter table public.control_rules enable row level security;
alter table public.monetization_settings enable row level security;
alter table public.training_permissions enable row level security;

create policy "profiles are viewable by owner"
on public.profiles for select
using (id = auth.uid());

create policy "profiles are insertable by owner"
on public.profiles for insert
with check (id = auth.uid());

create policy "profiles are updatable by owner"
on public.profiles for update
using (id = auth.uid())
with check (id = auth.uid());

create policy "workspaces are viewable by members"
on public.workspaces for select
using (public.is_workspace_member(id));

create policy "workspace owners can create workspaces"
on public.workspaces for insert
with check (owner_id = auth.uid());

create policy "workspace admins can update workspaces"
on public.workspaces for update
using (public.has_workspace_role(id, array['owner', 'admin']::public.workspace_role[]))
with check (public.has_workspace_role(id, array['owner', 'admin']::public.workspace_role[]));

create policy "workspace members are viewable by members"
on public.workspace_members for select
using (public.is_workspace_member(workspace_id));

create policy "workspace owners can add themselves as first member"
on public.workspace_members for insert
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.workspaces w
    where w.id = workspace_id
      and w.owner_id = auth.uid()
  )
);

create policy "workspace owners can manage members"
on public.workspace_members for all
using (public.has_workspace_role(workspace_id, array['owner', 'admin']::public.workspace_role[]))
with check (public.has_workspace_role(workspace_id, array['owner', 'admin']::public.workspace_role[]));

create policy "domains are viewable by members"
on public.domains for select
using (public.is_workspace_member(workspace_id));

create policy "domains are manageable by admins"
on public.domains for all
using (public.has_workspace_role(workspace_id, array['owner', 'admin']::public.workspace_role[]))
with check (public.has_workspace_role(workspace_id, array['owner', 'admin']::public.workspace_role[]));

create policy "api keys are viewable by admins"
on public.api_keys for select
using (public.has_workspace_role(workspace_id, array['owner', 'admin']::public.workspace_role[]));

create policy "api keys are manageable by admins"
on public.api_keys for all
using (public.has_workspace_role(workspace_id, array['owner', 'admin']::public.workspace_role[]))
with check (public.has_workspace_role(workspace_id, array['owner', 'admin']::public.workspace_role[]));

create policy "activity logs are viewable by members"
on public.activity_logs for select
using (public.is_workspace_member(workspace_id));

create policy "activity logs are insertable by admins"
on public.activity_logs for insert
with check (public.has_workspace_role(workspace_id, array['owner', 'admin']::public.workspace_role[]));

create policy "visibility checks are viewable by members"
on public.visibility_checks for select
using (public.is_workspace_member(workspace_id));

create policy "visibility checks are insertable by members"
on public.visibility_checks for insert
with check (public.is_workspace_member(workspace_id));

create policy "control rules are viewable by members"
on public.control_rules for select
using (public.is_workspace_member(workspace_id));

create policy "control rules are manageable by admins"
on public.control_rules for all
using (public.has_workspace_role(workspace_id, array['owner', 'admin']::public.workspace_role[]))
with check (public.has_workspace_role(workspace_id, array['owner', 'admin']::public.workspace_role[]));

create policy "monetization settings are viewable by members"
on public.monetization_settings for select
using (public.is_workspace_member(workspace_id));

create policy "monetization settings are manageable by admins"
on public.monetization_settings for all
using (public.has_workspace_role(workspace_id, array['owner', 'admin']::public.workspace_role[]))
with check (public.has_workspace_role(workspace_id, array['owner', 'admin']::public.workspace_role[]));

create policy "training permissions are viewable by members"
on public.training_permissions for select
using (public.is_workspace_member(workspace_id));

create policy "training permissions are manageable by admins"
on public.training_permissions for all
using (public.has_workspace_role(workspace_id, array['owner', 'admin']::public.workspace_role[]))
with check (public.has_workspace_role(workspace_id, array['owner', 'admin']::public.workspace_role[]));
