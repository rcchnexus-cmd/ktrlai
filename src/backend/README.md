# KtrlAI Supabase Setup

Run these SQL files in order in the Supabase SQL editor before enabling production backend writes:

1. `schema.sql`
2. `billing_migration.sql`
3. `domain_api_key_comments.sql`
4. `track_ingestion_migration.sql`
5. `api_key_hashing_migration.sql`
6. `domain_verification_migration.sql`
7. `pre_production_hardening.sql`
8. `admin_dashboard_migration.sql`
9. `stripe_webhook_idempotency.sql`
10. `analytics_engine_migration.sql`
11. `bot_detection_migration.sql`
12. `enterprise_security_migration.sql`
13. `scale_optimization_migration.sql`
14. `notifications_migration.sql`

Frontend code must use only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
Serverless functions use `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and any server-only secrets such as `API_KEY_HASH_SECRET`.

Keep Row Level Security enabled on every workspace-owned table. Serverless functions that use the service role key must validate workspace ownership or use authenticated workspace-member checks before enabling live production mutations.

## Runtime Mode Rules

Production mode is detected from Vite's production build on the frontend and `NODE_ENV=production` or `VERCEL_ENV=production` in serverless functions.

In production:

- Supabase frontend and server env vars are required for auth, workspace settings, domain writes, API key rotation, tracker ingestion, and domain verification.
- Serverless API routes return clear JSON configuration errors when required server env vars are missing.
- Domain verification and API key rotation do not fall back to local sample behavior.
- Tracker ingestion validates hashed API keys, enforces usage checks, writes to `activity_logs`, and returns `mode: "live"`.
- Payout requests stay disabled unless `PAYOUT_REQUESTS_ENABLED=true`.

In local development, missing backend env vars may use local sample responses so the UI can still be exercised without a Supabase or Stripe project.

## Vercel Environment Variables

Add these in Vercel Project Settings before enabling private-beta backend flows:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_STRIPE_PUBLISHABLE_KEY`
- `VITE_APP_URL`
- `VITE_SHOW_INVESTOR_SAMPLE_DATA=true`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `API_KEY_HASH_SECRET`
- `APP_URL`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRO_PRICE_ID`
- `STRIPE_BUSINESS_PRICE_ID`
- `PAYOUT_REQUESTS_ENABLED=false`
- `EMAIL_PROVIDER`
- `EMAIL_FROM`
- `SUPPORT_EMAIL`
- `RESEND_API_KEY` if using Resend
- `SENDGRID_API_KEY` if using SendGrid later
- `POSTMARK_SERVER_TOKEN` if using Postmark later

`PAYOUT_REQUESTS_ENABLED` must remain `false` until Stripe Connect onboarding, payout review, and live payout execution are implemented.

Email provider keys are server-only. Do not create `VITE_` email provider variables.

`dist/` and `node_modules/` are generated artifacts and should not be committed. Vercel should install dependencies and run `npm run build`.
