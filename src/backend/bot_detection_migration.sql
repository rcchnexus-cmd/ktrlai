-- KtrlAI AI bot detection intelligence
-- Run after analytics_engine_migration.sql. The tracker also stores these
-- values in metadata so ingestion remains backward-compatible before this
-- migration is applied.

alter table public.activity_logs
  add column if not exists category text,
  add column if not exists confidence_score integer check (confidence_score between 0 and 100),
  add column if not exists is_ai_bot boolean not null default false,
  add column if not exists is_search_engine boolean not null default false,
  add column if not exists is_suspicious boolean not null default false,
  add column if not exists detection_method text;

create index if not exists activity_logs_workspace_category_idx
  on public.activity_logs (workspace_id, category, occurred_at desc);

create index if not exists activity_logs_workspace_ai_bot_idx
  on public.activity_logs (workspace_id, is_ai_bot, occurred_at desc);

create index if not exists activity_logs_workspace_suspicious_idx
  on public.activity_logs (workspace_id, is_suspicious, occurred_at desc);

create index if not exists activity_logs_workspace_confidence_idx
  on public.activity_logs (workspace_id, confidence_score desc)
  where confidence_score is not null;

comment on column public.activity_logs.category is
  'Bot detection category: ai_assistant, ai_training, search_engine, social_preview, scraper, browser, or unknown.';

comment on column public.activity_logs.confidence_score is
  'Bot detection confidence score from 0 to 100.';

comment on column public.activity_logs.is_ai_bot is
  'True when the event user agent or referrer matches AI crawler or AI assistant signatures.';

comment on column public.activity_logs.is_search_engine is
  'True when the event appears to come from a conventional search crawler.';

comment on column public.activity_logs.is_suspicious is
  'True when the event matches scraping libraries, empty agents, fake browser agents, or unknown crawler patterns.';

comment on column public.activity_logs.detection_method is
  'Detection rule that produced the bot classification.';
