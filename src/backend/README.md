# KtrlAI Supabase Setup

Run these SQL files in order in the Supabase SQL editor before enabling production backend writes:

1. `schema.sql`
2. `billing_migration.sql`
3. `domain_api_key_comments.sql`
4. `track_ingestion_migration.sql`
5. `api_key_hashing_migration.sql`
6. `domain_verification_migration.sql`
7. `pre_production_hardening.sql`

Frontend code must use only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
Serverless functions use `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and any server-only secrets such as `API_KEY_HASH_SECRET`.

Keep Row Level Security enabled on every workspace-owned table. Serverless functions that use the service role key must validate workspace ownership or use authenticated workspace-member checks before enabling live production mutations.

## Vercel Environment Variables

Add these in Vercel Project Settings before enabling private-beta backend flows:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_STRIPE_PUBLISHABLE_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `API_KEY_HASH_SECRET`
- `APP_URL`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRO_PRICE_ID`
- `STRIPE_BUSINESS_PRICE_ID`
- `PAYOUT_REQUESTS_ENABLED=false`

`PAYOUT_REQUESTS_ENABLED` must remain `false` until Stripe Connect onboarding, payout review, and live payout execution are implemented.

`dist/` and `node_modules/` are generated artifacts and should not be committed. Vercel should install dependencies and run `npm run build`.
