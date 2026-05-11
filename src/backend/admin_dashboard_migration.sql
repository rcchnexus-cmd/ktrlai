-- KtrlAI Admin Dashboard / Internal Control System
-- Run after the base schema and pre-production hardening migrations.
-- This table is for KtrlAI platform operators only. Workspace users should
-- never receive platform-wide admin access through workspace roles.

create table if not exists public.platform_admins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'admin' check (role in ('admin', 'owner', 'operator')),
  created_at timestamptz not null default now(),
  unique (user_id)
);

create index if not exists platform_admins_user_id_idx
  on public.platform_admins (user_id);

alter table public.platform_admins enable row level security;

create or replace function public.is_platform_admin(target_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.platform_admins pa
    where pa.user_id = target_user_id
      and pa.role in ('admin', 'owner', 'operator')
  );
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'platform_admins'
      and policyname = 'platform admins can view admin records'
  ) then
    create policy "platform admins can view admin records"
    on public.platform_admins for select
    using (public.is_platform_admin(auth.uid()));
  end if;
end $$;

comment on table public.platform_admins is
  'KtrlAI internal platform administrator allow-list. Checked by server-side admin API routes before platform-wide reads.';

comment on column public.platform_admins.user_id is
  'References public.profiles.id, which mirrors auth.users.id for the admin user.';

comment on function public.is_platform_admin(uuid) is
  'Returns true when the target user is listed as a KtrlAI platform admin. Used only for admin visibility checks; server routes still verify bearer tokens.';

-- To make your current Supabase user a platform admin, replace USER_ID with
-- your public.profiles.id / auth.users.id value and run this in Supabase SQL:
--
-- insert into public.platform_admins (user_id, role)
-- values ('USER_ID'::uuid, 'admin')
-- on conflict (user_id) do update set role = excluded.role;
