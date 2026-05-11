-- KtrlAI analytics engine foundation
-- Run after schema.sql, track_ingestion_migration.sql, and pre_production_hardening.sql.
-- This migration adds read-optimized indexes and security-invoker views for
-- analytics dashboards without duplicating raw activity log data.

create index if not exists activity_logs_workspace_occurred_analytics_idx
  on public.activity_logs (workspace_id, occurred_at desc);

create index if not exists activity_logs_workspace_bot_type_idx
  on public.activity_logs (workspace_id, bot_type);

create index if not exists activity_logs_workspace_domain_idx
  on public.activity_logs (workspace_id, domain_id)
  where domain_id is not null;

create index if not exists activity_logs_workspace_status_idx
  on public.activity_logs (workspace_id, status);

create index if not exists activity_logs_workspace_page_path_idx
  on public.activity_logs (workspace_id, page_path);

create or replace view public.workspace_event_counts_daily
with (security_invoker = true)
as
select
  workspace_id,
  date_trunc('day', occurred_at)::date as event_date,
  count(*)::bigint as total_events,
  count(distinct bot_type)::bigint as unique_bot_types,
  count(distinct coalesce(nullif(page_path, ''), url))::bigint as pages_accessed
from public.activity_logs
group by workspace_id, date_trunc('day', occurred_at)::date;

create or replace view public.workspace_bot_distribution
with (security_invoker = true)
as
select
  workspace_id,
  bot_type,
  count(*)::bigint as total_events,
  max(occurred_at) as last_seen_at
from public.activity_logs
group by workspace_id, bot_type;

create or replace view public.workspace_top_pages
with (security_invoker = true)
as
select
  workspace_id,
  coalesce(nullif(page_title, ''), nullif(page_path, ''), url, 'Untitled page') as page,
  count(*)::bigint as total_events,
  max(occurred_at) as last_seen_at
from public.activity_logs
group by workspace_id, coalesce(nullif(page_title, ''), nullif(page_path, ''), url, 'Untitled page');

comment on view public.workspace_event_counts_daily is
  'Daily per-workspace activity counts for dashboard analytics. Uses security_invoker so RLS still applies when queried without service role.';

comment on view public.workspace_bot_distribution is
  'Per-workspace bot distribution derived from activity_logs without duplicating raw events.';

comment on view public.workspace_top_pages is
  'Per-workspace top pages derived from activity_logs for compact analytics responses.';
