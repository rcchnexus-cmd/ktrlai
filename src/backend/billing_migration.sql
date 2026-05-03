-- KtrlAI Phase 2 billing foundation
-- Run this after src/backend/schema.sql. It is additive and safe for an
-- existing Phase 1 Supabase project.
--
-- The plan column already exists on public.profiles and public.workspaces in
-- the Phase 1 schema. This migration adds Stripe subscription metadata needed
-- for hosted Checkout and webhook-driven workspace plan updates.

alter table public.workspaces
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists subscription_status text not null default 'free',
  add column if not exists current_period_end timestamptz;

alter table public.profiles
  add column if not exists stripe_customer_id text;

create index if not exists workspaces_stripe_customer_idx
  on public.workspaces (stripe_customer_id)
  where stripe_customer_id is not null;

create index if not exists workspaces_stripe_subscription_idx
  on public.workspaces (stripe_subscription_id)
  where stripe_subscription_id is not null;

comment on column public.workspaces.stripe_customer_id is
  'Stripe customer ID associated with the workspace subscription.';

comment on column public.workspaces.stripe_subscription_id is
  'Stripe subscription ID for the active or most recent workspace subscription.';

comment on column public.workspaces.subscription_status is
  'Stripe subscription status mirrored by the webhook, such as active, trialing, past_due, canceled, or free.';

comment on column public.workspaces.current_period_end is
  'Current Stripe subscription period end timestamp mirrored by the webhook.';

comment on column public.profiles.stripe_customer_id is
  'Optional Stripe customer ID for user-level customer lookup before a workspace is resolved.';
