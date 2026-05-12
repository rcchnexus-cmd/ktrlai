-- KtrlAI scale + optimization migration
-- Run after schema.sql, billing/admin/analytics, bot detection, webhook, and
-- enterprise security migrations. These indexes match production hot paths used
-- by tracker ingestion, analytics summaries, admin monitoring, and team security.

create index if not exists activity_logs_workspace_status_occurred_idx
  on public.activity_logs (workspace_id, status, occurred_at desc);

create index if not exists activity_logs_workspace_bot_occurred_idx
  on public.activity_logs (workspace_id, bot_type, occurred_at desc);

create index if not exists activity_logs_workspace_page_occurred_idx
  on public.activity_logs (workspace_id, page_path, occurred_at desc);

create index if not exists activity_logs_workspace_recent_paid_idx
  on public.activity_logs (workspace_id, occurred_at desc)
  where status = 'paid_access';

create index if not exists workspace_members_user_workspace_idx
  on public.workspace_members (user_id, workspace_id);

create index if not exists domains_workspace_hostname_status_idx
  on public.domains (workspace_id, hostname, status);

create index if not exists workspace_usage_months_lookup_idx
  on public.workspace_usage_months (workspace_id, month_start);

create index if not exists audit_logs_workspace_event_timestamp_idx
  on public.audit_logs (workspace_id, event_type, timestamp desc);

create index if not exists rate_limit_events_workspace_scope_created_idx
  on public.rate_limit_events (workspace_id, scope, created_at desc);

create index if not exists ai_policies_workspace_policy_idx
  on public.ai_policies (workspace_id, policy_type, updated_at desc);

create index if not exists stripe_webhook_events_status_created_idx
  on public.stripe_webhook_events (status, created_at desc);

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'activity_logs'
      and column_name = 'is_ai_bot'
  ) then
    execute 'create index if not exists activity_logs_workspace_ai_recent_partial_idx
      on public.activity_logs (workspace_id, occurred_at desc)
      where is_ai_bot = true';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'activity_logs'
      and column_name = 'is_suspicious'
  ) then
    execute 'create index if not exists activity_logs_workspace_suspicious_recent_partial_idx
      on public.activity_logs (workspace_id, occurred_at desc)
      where is_suspicious = true';
  end if;
end $$;

comment on index public.activity_logs_workspace_status_occurred_idx is
  'Supports workspace analytics status counts and recent filtered activity.';

comment on index public.activity_logs_workspace_bot_occurred_idx is
  'Supports bot distribution queries without scanning all workspace events.';

comment on index public.activity_logs_workspace_page_occurred_idx is
  'Supports top-page analytics and recent page activity.';

comment on index public.workspace_usage_months_lookup_idx is
  'Supports per-event usage-limit checks without counting raw activity_logs.';

comment on index public.rate_limit_events_workspace_scope_created_idx is
  'Supports admin security review of recent rate-limit triggers.';

-- Future scale note:
-- When activity volume grows past raw-query comfort, replace server-side
-- in-request aggregation with daily rollup tables or materialized views that are
-- refreshed by scheduled jobs.
