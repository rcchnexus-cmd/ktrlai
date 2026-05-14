-- KtrlAI notification delivery foundation.
-- Run after the base schema and enterprise security migration.

alter table public.workspaces
add column if not exists notification_preferences jsonb not null default jsonb_build_object(
  'emailNotifications', true,
  'installVerified', true,
  'billingAlerts', true,
  'suspiciousCrawlerAlerts', true,
  'teamInviteEmails', true
);

comment on column public.workspaces.notification_preferences is
  'Workspace-level email notification preferences. Provider secrets stay server-side.';

create table if not exists public.notification_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  type text not null,
  recipient_email text not null,
  status text not null default 'queued' check (status in ('queued', 'sent', 'skipped', 'failed')),
  provider text not null default 'noop',
  provider_message_id text,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

comment on table public.notification_events is
  'Auditable notification delivery log. Full provider API keys and email secrets are never stored here.';

create index if not exists notification_events_workspace_id_idx
  on public.notification_events(workspace_id);

create index if not exists notification_events_user_id_idx
  on public.notification_events(user_id);

create index if not exists notification_events_type_idx
  on public.notification_events(type);

create index if not exists notification_events_status_idx
  on public.notification_events(status);

create index if not exists notification_events_created_at_idx
  on public.notification_events(created_at desc);

create index if not exists notification_events_workspace_type_created_idx
  on public.notification_events(workspace_id, type, created_at desc);

alter table public.notification_events enable row level security;

drop policy if exists "Owners and admins can read notification events" on public.notification_events;
create policy "Owners and admins can read notification events"
on public.notification_events
for select
using (public.has_workspace_role(workspace_id, array['owner', 'admin']::public.workspace_role[]));

-- Inserts and updates are intentionally server-only through Supabase service role API routes.
-- Supabase service role bypasses RLS; do not create public insert/update policies for notification_events.
