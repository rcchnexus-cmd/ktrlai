-- KtrlAI enterprise + security foundation.
-- Run after the base schema, billing, analytics, admin, and API key migrations.
-- This migration adds team collaboration, centralized workspace audit logs,
-- AI governance policy records, and operational rate-limit visibility.

create table if not exists public.workspace_invitations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  email text not null,
  role text not null default 'viewer',
  status text not null default 'pending',
  token text not null unique,
  invited_by uuid references public.profiles(id) on delete set null,
  accepted_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '14 days'),
  accepted_at timestamptz,
  revoked_at timestamptz,
  constraint workspace_invitations_role_check check (role in ('admin', 'analyst', 'viewer')),
  constraint workspace_invitations_status_check check (status in ('pending', 'accepted', 'revoked', 'expired'))
);

create index if not exists workspace_invitations_workspace_idx
  on public.workspace_invitations(workspace_id, created_at desc);

create index if not exists workspace_invitations_email_idx
  on public.workspace_invitations(lower(email));

do $$
declare
  role_name text;
begin
  if not exists (
    select 1
    from pg_type
    where typnamespace = 'public'::regnamespace
      and typname = 'workspace_role'
  ) then
    raise exception 'public.workspace_role enum is required. Run the base schema before enterprise_security_migration.sql.';
  end if;

  foreach role_name in array array['owner', 'admin', 'member', 'analyst', 'viewer']
  loop
    if not exists (
      select 1
      from pg_enum e
      join pg_type t on t.oid = e.enumtypid
      where t.typnamespace = 'public'::regnamespace
        and t.typname = 'workspace_role'
        and e.enumlabel = role_name
    ) then
      execute format('alter type public.workspace_role add value %L', role_name);
    end if;
  end loop;
end $$;

alter table public.workspace_members
  alter column role set default 'member';

alter table public.workspace_members
  drop constraint if exists workspace_members_role_check;

alter table public.workspace_members
  add constraint workspace_members_role_check
  check (role::text in ('owner', 'admin', 'member', 'analyst', 'viewer'));

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade,
  actor_user_id uuid references public.profiles(id) on delete set null,
  event_type text not null,
  event_summary text not null,
  metadata jsonb not null default '{}'::jsonb,
  timestamp timestamptz not null default now()
);

create index if not exists audit_logs_workspace_timestamp_idx
  on public.audit_logs(workspace_id, timestamp desc);

create index if not exists audit_logs_event_type_idx
  on public.audit_logs(event_type);

create table if not exists public.ai_policies (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  bot_scope text not null,
  policy_type text not null default 'monitor',
  notes text,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_policies_policy_type_check check (policy_type in ('allow', 'monitor', 'restrict', 'block')),
  unique (workspace_id, bot_scope)
);

create index if not exists ai_policies_workspace_idx
  on public.ai_policies(workspace_id, bot_scope);

create table if not exists public.rate_limit_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete set null,
  scope text not null,
  ip_hash text,
  reason text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists rate_limit_events_workspace_created_idx
  on public.rate_limit_events(workspace_id, created_at desc);

create index if not exists rate_limit_events_scope_created_idx
  on public.rate_limit_events(scope, created_at desc);

create table if not exists public.abuse_counters (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade,
  counter_key text not null,
  counter_scope text not null,
  count integer not null default 0,
  window_start timestamptz not null,
  window_end timestamptz not null,
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  unique (workspace_id, counter_key, counter_scope, window_start)
);

alter table public.workspace_invitations enable row level security;
alter table public.audit_logs enable row level security;
alter table public.ai_policies enable row level security;
alter table public.rate_limit_events enable row level security;
alter table public.abuse_counters enable row level security;

drop policy if exists "Workspace members can read invitations" on public.workspace_invitations;
drop policy if exists "Owners and admins can read invitations" on public.workspace_invitations;
create policy "Owners and admins can read invitations"
  on public.workspace_invitations
  for select
  using (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = workspace_invitations.workspace_id
        and wm.user_id = auth.uid()
        and wm.role in ('owner', 'admin')
    )
  );

drop policy if exists "Owners can manage invitations" on public.workspace_invitations;
create policy "Owners can manage invitations"
  on public.workspace_invitations
  for all
  using (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = workspace_invitations.workspace_id
        and wm.user_id = auth.uid()
        and wm.role = 'owner'
    )
  )
  with check (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = workspace_invitations.workspace_id
        and wm.user_id = auth.uid()
        and wm.role = 'owner'
    )
  );

drop policy if exists "Workspace members can read audit logs" on public.audit_logs;
drop policy if exists "Owners and admins can read audit logs" on public.audit_logs;
create policy "Owners and admins can read audit logs"
  on public.audit_logs
  for select
  using (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = audit_logs.workspace_id
        and wm.user_id = auth.uid()
        and wm.role in ('owner', 'admin')
    )
  );

drop policy if exists "Workspace members can read AI policies" on public.ai_policies;
drop policy if exists "Owners and admins can read AI policies" on public.ai_policies;
create policy "Owners and admins can read AI policies"
  on public.ai_policies
  for select
  using (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = ai_policies.workspace_id
        and wm.user_id = auth.uid()
        and wm.role in ('owner', 'admin')
    )
  );

drop policy if exists "Owners and admins can manage AI policies" on public.ai_policies;
create policy "Owners and admins can manage AI policies"
  on public.ai_policies
  for all
  using (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = ai_policies.workspace_id
        and wm.user_id = auth.uid()
        and wm.role in ('owner', 'admin')
    )
  )
  with check (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = ai_policies.workspace_id
        and wm.user_id = auth.uid()
        and wm.role in ('owner', 'admin')
    )
  );

-- rate_limit_events and abuse_counters are operational tables.
-- Keep direct user access off by default; server-side APIs use the service role.

comment on table public.workspace_invitations is 'Pending invitations for multi-user workspace collaboration.';
comment on table public.audit_logs is 'Centralized workspace audit log for security, billing, domain, API key, and governance events.';
comment on table public.ai_policies is 'AI crawler governance policy foundation. This records intended policy; network blocking is not enabled yet.';
comment on table public.rate_limit_events is 'Server-recorded rate-limit and abuse-protection triggers for admin visibility.';
comment on table public.abuse_counters is 'Future durable abuse counters for high-volume production rate limiting.';
