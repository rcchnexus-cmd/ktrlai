-- KtrlAI Phase 8 pre-production backend hardening
-- Run after the Phase 1 schema and the Phase 5/6/7 migrations.

create table if not exists public.workspace_usage_months (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  month_start date not null,
  plan text not null default 'Free',
  events_used integer not null default 0 check (events_used >= 0),
  event_limit integer not null default 1000 check (event_limit >= 0),
  updated_at timestamptz not null default now(),
  unique (workspace_id, month_start)
);

create table if not exists public.earnings_ledger (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  source text not null,
  amount_cents integer not null check (amount_cents >= 0),
  currency text not null default 'USD',
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'reversed')),
  related_activity_log_id uuid references public.activity_logs(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.payout_requests (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  amount_cents integer not null check (amount_cents > 0),
  currency text not null default 'USD',
  status text not null default 'requested' check (status in ('requested', 'under_review', 'approved', 'rejected', 'paid')),
  requested_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  notes text
);

create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  event_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists workspace_usage_months_workspace_idx
  on public.workspace_usage_months (workspace_id, month_start desc);

create index if not exists earnings_ledger_workspace_status_idx
  on public.earnings_ledger (workspace_id, status, created_at desc);

create index if not exists payout_requests_workspace_status_idx
  on public.payout_requests (workspace_id, status, created_at desc);

create index if not exists audit_events_workspace_type_idx
  on public.audit_events (workspace_id, event_type, created_at desc);

alter table public.workspace_usage_months enable row level security;
alter table public.earnings_ledger enable row level security;
alter table public.payout_requests enable row level security;
alter table public.audit_events enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'workspace_usage_months'
      and policyname = 'usage months are viewable by members'
  ) then
    create policy "usage months are viewable by members"
    on public.workspace_usage_months for select
    using (public.is_workspace_member(workspace_id));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'earnings_ledger'
      and policyname = 'earnings ledger is viewable by members'
  ) then
    create policy "earnings ledger is viewable by members"
    on public.earnings_ledger for select
    using (public.is_workspace_member(workspace_id));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'payout_requests'
      and policyname = 'payout requests are viewable by members'
  ) then
    create policy "payout requests are viewable by members"
    on public.payout_requests for select
    using (public.is_workspace_member(workspace_id));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'payout_requests'
      and policyname = 'workspace admins can create payout requests'
  ) then
    create policy "workspace admins can create payout requests"
    on public.payout_requests for insert
    with check (public.has_workspace_role(workspace_id, array['owner', 'admin']::public.workspace_role[]));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'audit_events'
      and policyname = 'audit events are viewable by admins'
  ) then
    create policy "audit events are viewable by admins"
    on public.audit_events for select
    using (public.has_workspace_role(workspace_id, array['owner', 'admin']::public.workspace_role[]));
  end if;
end $$;

comment on table public.workspace_usage_months is
  'Monthly per-workspace usage counters used by /api/track for plan limits.';

comment on table public.earnings_ledger is
  'Append-only monetization ledger for pending, confirmed, and reversed AI access earnings.';

comment on table public.payout_requests is
  'Workspace payout request workflow. Stripe Connect payout execution is intentionally not live yet.';

comment on table public.audit_events is
  'Sensitive backend action log: API key rotation, domain verification, payout request, plan change, and future admin events.';

comment on column public.payout_requests.notes is
  'Internal review notes. Future Stripe Connect payout IDs should be added in a dedicated migration before live payouts.';
