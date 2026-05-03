-- KtrlAI Phase 6 secure API key hashing
-- Run after the Phase 1 schema. The base schema already defines key_hash and
-- key_prefix as not null; this migration reinforces lookup and revocation rules.

do $$
begin
  if exists (
    select 1
    from public.api_keys
    where key_hash is null
       or key_prefix is null
  ) then
    raise notice 'Skipping NOT NULL enforcement: backfill or revoke legacy api_keys rows with null key_hash/key_prefix first.';
  else
    alter table public.api_keys
      alter column key_hash set not null,
      alter column key_prefix set not null;
  end if;
end $$;

create index if not exists api_keys_workspace_prefix_active_idx
  on public.api_keys (workspace_id, key_prefix)
  where revoked_at is null;

create index if not exists api_keys_workspace_revoked_idx
  on public.api_keys (workspace_id, revoked_at);

comment on column public.api_keys.key_prefix is
  'Non-secret API key prefix used to narrow lookups before HMAC hash comparison.';

comment on column public.api_keys.key_hash is
  'HMAC-SHA256 hash of the API key using server-only API_KEY_HASH_SECRET. Never store the raw key.';

comment on column public.api_keys.revoked_at is
  'Set when a key is rotated or manually revoked. /api/track rejects revoked keys.';
