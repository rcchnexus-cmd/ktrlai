-- KtrlAI lightweight async jobs foundation.
-- Run after the base schema. This table is intentionally service-role only.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'job_status') then
    create type public.job_status as enum ('queued', 'processing', 'completed', 'failed');
  end if;
end $$;

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  status public.job_status not null default 'queued',
  payload jsonb not null default '{}'::jsonb,
  attempts integer not null default 0,
  max_attempts integer not null default 3,
  available_at timestamptz not null default now(),
  locked_at timestamptz,
  completed_at timestamptz,
  failed_at timestamptz,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint jobs_type_check check (type in ('send_email', 'analytics_rollup', 'suspicious_alert', 'audit_event', 'cleanup_task')),
  constraint jobs_attempts_check check (attempts >= 0 and max_attempts between 1 and 10)
);

comment on table public.jobs is
  'Internal async job queue for notifications, analytics rollups, audit fanout, and scheduled maintenance. Process only with server-side service role routes.';

create index if not exists jobs_status_idx
  on public.jobs(status);

create index if not exists jobs_type_idx
  on public.jobs(type);

create index if not exists jobs_available_at_idx
  on public.jobs(available_at);

create index if not exists jobs_created_at_idx
  on public.jobs(created_at desc);

create index if not exists jobs_status_available_created_idx
  on public.jobs(status, available_at, created_at);

drop trigger if exists jobs_set_updated_at on public.jobs;
create trigger jobs_set_updated_at
before update on public.jobs
for each row execute function public.set_updated_at();

alter table public.jobs enable row level security;

-- Do not add public RLS policies. Supabase service role bypasses RLS for the
-- internal job runner and admin summary. Platform admins view sanitized job
-- metadata through /api/admin?action=summary only.
