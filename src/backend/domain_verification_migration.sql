-- KtrlAI Phase 7 real DNS TXT domain verification
-- Run after the Phase 1 schema. This keeps existing domain records intact.

alter type public.domain_status add value if not exists 'failed';

alter table public.domains
  add column if not exists last_checked_at timestamptz;

create index if not exists domains_workspace_hostname_idx
  on public.domains (workspace_id, hostname);

create index if not exists domains_workspace_last_checked_idx
  on public.domains (workspace_id, last_checked_at desc);

comment on column public.domains.verification_token is
  'DNS TXT token expected at _ktrlai.<hostname> as ktrlai-verify=<verification_token>.';

comment on column public.domains.status is
  'Domain verification lifecycle: pending, verified, failed, or disabled.';

comment on column public.domains.verified_at is
  'Timestamp set when /api/app?action=verify-domain finds the expected DNS TXT record.';

comment on column public.domains.last_checked_at is
  'Timestamp set whenever /api/app?action=verify-domain checks DNS for this domain.';
