-- KtrlAI Phase 3 domain verification and API key notes
-- The Phase 1 schema already includes these backend-ready columns. This file
-- documents how the mock Settings UI maps to production Supabase storage.

comment on column public.domains.verification_token is
  'DNS TXT verification token shown as ktrlai-verify=<token>. Generated server-side in production.';

comment on column public.domains.verified_at is
  'Timestamp set after a server-side DNS TXT lookup verifies domain ownership.';

comment on column public.api_keys.key_hash is
  'One-way hash of the workspace API key. Never store or expose the full live key after creation.';

comment on column public.api_keys.last_used_at is
  'Timestamp updated by server-side ingestion when a key successfully submits workspace events.';
