-- KtrlAI Stripe webhook idempotency
-- Run after billing_migration.sql and pre_production_hardening.sql.
-- Serverless webhook code writes to this table with the Supabase service role.

create table if not exists public.stripe_webhook_events (
  id uuid primary key default gen_random_uuid(),
  event_id text not null unique,
  event_type text not null,
  workspace_id uuid references public.workspaces(id) on delete set null,
  status text not null default 'processing' check (status in ('processing', 'processed', 'ignored', 'failed')),
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists stripe_webhook_events_type_created_idx
  on public.stripe_webhook_events (event_type, created_at desc);

create index if not exists stripe_webhook_events_workspace_idx
  on public.stripe_webhook_events (workspace_id, created_at desc)
  where workspace_id is not null;

alter table public.stripe_webhook_events enable row level security;

comment on table public.stripe_webhook_events is
  'Stripe webhook replay guard. Each verified Stripe event ID is inserted before processing and updated after completion.';

comment on column public.stripe_webhook_events.metadata is
  'Safe webhook processing metadata only. Do not store full Stripe payloads or sensitive payment details here.';
