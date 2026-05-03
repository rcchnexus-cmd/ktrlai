-- KtrlAI Phase 5 tracker ingestion fields
-- Run this after the Phase 1 schema before enabling real /api/track writes.
-- Existing fields such as workspace_id, domain_id, bot_type, user_agent,
-- status, occurred_at, and metadata remain unchanged.

alter table public.activity_logs
  add column if not exists url text,
  add column if not exists referrer text,
  add column if not exists page_title text;

create index if not exists activity_logs_workspace_url_idx
  on public.activity_logs (workspace_id, url);

comment on column public.activity_logs.url is
  'Full page URL captured by the KtrlAI tracker script.';

comment on column public.activity_logs.referrer is
  'Document referrer captured by the KtrlAI tracker script.';

comment on column public.activity_logs.page_title is
  'Page title captured by the KtrlAI tracker script.';
