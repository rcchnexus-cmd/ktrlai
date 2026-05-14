-- KtrlAI materialized analytics rollup foundation
-- Run after analytics_engine_migration.sql and bot_detection_migration.sql.
-- These tables keep dashboard analytics fast as activity_logs grows while
-- preserving raw events for audit, recent activity, and reprocessing.

create table if not exists public.analytics_daily_rollups (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  date_bucket date not null,
  event_count bigint not null default 0,
  unique_bot_count integer not null default 0,
  page_count integer not null default 0,
  ai_bot_count bigint not null default 0,
  human_event_count bigint not null default 0,
  suspicious_event_count bigint not null default 0,
  high_confidence_training_count bigint not null default 0,
  confidence_total bigint not null default 0,
  confidence_count bigint not null default 0,
  allowed_count bigint not null default 0,
  blocked_count bigint not null default 0,
  restricted_count bigint not null default 0,
  paid_access_count bigint not null default 0,
  status_counts jsonb not null default '{}'::jsonb,
  category_counts jsonb not null default '{}'::jsonb,
  estimated_revenue_cents integer not null default 0,
  first_event_at timestamptz,
  last_event_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (workspace_id, date_bucket)
);

create table if not exists public.analytics_bot_rollups (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  date_bucket date not null,
  bot_type text not null,
  bot_name text not null default 'UnknownBot',
  category text not null default 'unknown',
  is_ai_bot boolean not null default false,
  is_suspicious boolean not null default false,
  event_count bigint not null default 0,
  confidence_total bigint not null default 0,
  confidence_count bigint not null default 0,
  last_seen_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (workspace_id, date_bucket, bot_type)
);

create table if not exists public.analytics_page_rollups (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  date_bucket date not null,
  page_key text not null,
  page_label text not null,
  event_count bigint not null default 0,
  paid_access_count bigint not null default 0,
  estimated_revenue_cents integer not null default 0,
  last_seen_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (workspace_id, date_bucket, page_key)
);

create table if not exists public.analytics_status_rollups (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  date_bucket date not null,
  status text not null,
  event_count bigint not null default 0,
  updated_at timestamptz not null default now(),
  primary key (workspace_id, date_bucket, status)
);

create table if not exists public.analytics_rollup_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete set null,
  status text not null default 'completed' check (status in ('completed', 'partial', 'failed')),
  window_start timestamptz not null,
  window_end timestamptz not null,
  processed_events bigint not null default 0,
  processed_days integer not null default 0,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists analytics_daily_rollups_workspace_date_idx
  on public.analytics_daily_rollups (workspace_id, date_bucket desc);

create index if not exists analytics_bot_rollups_workspace_date_count_idx
  on public.analytics_bot_rollups (workspace_id, date_bucket desc, event_count desc);

create index if not exists analytics_page_rollups_workspace_date_count_idx
  on public.analytics_page_rollups (workspace_id, date_bucket desc, event_count desc);

create index if not exists analytics_status_rollups_workspace_date_idx
  on public.analytics_status_rollups (workspace_id, date_bucket desc);

create index if not exists analytics_rollup_runs_workspace_created_idx
  on public.analytics_rollup_runs (workspace_id, created_at desc);

create index if not exists analytics_rollup_runs_status_created_idx
  on public.analytics_rollup_runs (status, created_at desc);

alter table public.analytics_daily_rollups enable row level security;
alter table public.analytics_bot_rollups enable row level security;
alter table public.analytics_page_rollups enable row level security;
alter table public.analytics_status_rollups enable row level security;
alter table public.analytics_rollup_runs enable row level security;

drop policy if exists "analytics daily rollups are viewable by members" on public.analytics_daily_rollups;
create policy "analytics daily rollups are viewable by members"
on public.analytics_daily_rollups for select
using (public.is_workspace_member(workspace_id));

drop policy if exists "analytics bot rollups are viewable by members" on public.analytics_bot_rollups;
create policy "analytics bot rollups are viewable by members"
on public.analytics_bot_rollups for select
using (public.is_workspace_member(workspace_id));

drop policy if exists "analytics page rollups are viewable by members" on public.analytics_page_rollups;
create policy "analytics page rollups are viewable by members"
on public.analytics_page_rollups for select
using (public.is_workspace_member(workspace_id));

drop policy if exists "analytics status rollups are viewable by members" on public.analytics_status_rollups;
create policy "analytics status rollups are viewable by members"
on public.analytics_status_rollups for select
using (public.is_workspace_member(workspace_id));

drop policy if exists "analytics rollup runs are viewable by admins" on public.analytics_rollup_runs;
create policy "analytics rollup runs are viewable by admins"
on public.analytics_rollup_runs for select
using (
  public.has_workspace_role(workspace_id, array['owner', 'admin']::public.workspace_role[])
  or exists (
    select 1
    from public.platform_admins
    where platform_admins.user_id = auth.uid()
  )
);

comment on table public.analytics_daily_rollups is
  'Materialized daily workspace analytics used for fast dashboard summaries.';

comment on table public.analytics_bot_rollups is
  'Materialized daily bot distribution and AI crawler detection counts.';

comment on table public.analytics_page_rollups is
  'Materialized daily top-page analytics for workspace dashboards.';

comment on table public.analytics_status_rollups is
  'Materialized daily allowed/blocked/status distribution counts.';

comment on table public.analytics_rollup_runs is
  'Operational ledger for analytics rollup job executions and coverage windows.';
