# KtrlAI V1 Production Execution Plan

## V1 Objective

V1 means KtrlAI is operationally ready for real customer workspaces using the systems that already exist.

For V1, a customer should be able to:

- Sign up, log in, refresh, and keep a valid session.
- Create or access a workspace.
- Generate a workspace API key.
- Add and verify a domain.
- Install the tracker script.
- Send real tracker events into the ingestion pipeline.
- See live activity and analytics from those events.
- Persist governance policies.
- Use Stripe-hosted billing flows in test or production mode.
- Give platform operators enough health, admin, and audit visibility to diagnose failures.

V1 does not mean adding new product modules. It means making the current product reliable, verifiable, and safe to operate.

## Core Stabilization Principles

- Evolve systems, do not rewrite.
- Preserve ingestion compatibility.
- Preserve API contracts.
- Preserve tracker compatibility.
- Stabilize before expanding.
- Avoid touching fragile files casually.
- Keep production behavior explicit and safe.
- Keep local fallback useful, but never let production silently fake success.
- Verify live behavior before refactoring.
- Prefer small, reversible fixes over broad restructuring.

# Phase 1 — Migration & Environment Readiness

## Objective

Verify that the production database, environment variables, deployment configuration, and server-only secret boundaries are ready before any feature-level stabilization begins.

## Systems involved

- Supabase schema and migrations.
- Vercel environment variables.
- Runtime mode detection.
- Server-only Supabase admin access.
- Frontend Supabase anon access.
- Health endpoint readiness.
- Stripe, Redis, email, jobs, and app URL configuration.

## Implementation goals

- Confirm every required SQL migration can run in order.
- Confirm existing databases can accept pending migrations safely.
- Confirm Vercel production env vars match required runtime expectations.
- Confirm server-only secrets are not exposed to frontend code.
- Confirm missing optional services produce clear readiness signals.

## Implementation order

1. Prepare a clean Supabase staging project.
2. Run migrations in the documented sequence.
3. Run compatibility checks against an existing database copy if available.
4. Verify required Vercel environment variables.
5. Verify optional service configuration and fallback behavior.
6. Call the health endpoint in a production-like environment.
7. Document any migration or environment blockers.

## Dependencies

- Access to Supabase staging.
- Access to Vercel project settings.
- Access to Stripe test configuration.
- Decision on Redis and email provider setup for V1.

## Risks

- Migration order errors can block all downstream validation.
- Existing enum values or old rows can break enterprise migrations.
- Missing env vars can cause production actions to fail late.
- Optional fallback behavior can hide incomplete setup.

## Files likely involved

- `src/backend/README.md`
- `src/backend/schema.sql`
- `src/backend/*.sql`
- `.env.example`
- `vercel.json`
- `api/_runtime.js`
- `src/config/runtime.js`
- `api/_supabaseAdmin.js`
- `src/lib/supabaseClient.js`
- `api/health.js`

## What should remain untouched

- Do not rename environment variables.
- Do not move service-role logic into frontend files.
- Do not change Vercel rewrite ordering.
- Do not change API contracts.
- Do not redesign or refactor UI.

## Acceptance criteria

- All migrations run successfully on a clean staging database.
- Existing database compatibility issues are known or resolved.
- Required Vercel env vars are documented and present.
- Health endpoint returns safe readiness data.
- No secrets are exposed through frontend variables.
- Build passes after environment readiness checks.

## Definition of done

Phase 1 is complete when the database and environment are known-good enough that later failures can be treated as application issues, not setup uncertainty.

# Phase 2 — Test Coverage & Smoke Tests

## Objective

Create the minimum repeatable verification layer needed to prevent regressions while stabilizing V1.

## Systems involved

- Build pipeline.
- Route loading.
- Protected route behavior.
- Auth/session restoration.
- Grouped API routes.
- Tracker ingestion endpoint.
- Billing endpoints.
- Analytics endpoint.
- Settings actions.

## Implementation goals

- Establish a baseline smoke-test routine.
- Verify critical routes load.
- Verify protected routes redirect correctly.
- Verify API routes return safe JSON errors.
- Verify grouped serverless routes can be imported or syntax-checked.
- Keep tests lightweight and stabilization-focused.

## Implementation order

1. Run the current production build.
2. Add or document API import/syntax smoke checks.
3. Define route smoke checks for public and protected routes.
4. Verify unauthenticated protected-route redirects.
5. Verify login, signup, logout, and refresh behavior.
6. Verify API routes reject missing or invalid auth safely.
7. Record failures as targeted V1 blockers.

## Dependencies

- Phase 1 environment clarity.
- Working local or staging deployment.
- Test user credentials.
- Test workspace.

## Risks

- Overbuilding tests can become a refactor project.
- Tests may become brittle if they depend on sample data.
- Live and local fallback behavior must be tested separately.

## Files likely involved

- `package.json`
- `src/App.jsx`
- `src/navigation.jsx`
- `src/context/AppContext.jsx`
- `src/auth/supabaseAuth.js`
- `src/settings/securityUtils.js`
- `src/analytics/analyticsApi.js`
- `api/*.js`
- `api/_*.js`
- `api/internal/jobs.js`

## What should remain untouched

- Do not replace the router.
- Do not rewrite AppContext.
- Do not decompose large pages yet.
- Do not redesign error states.
- Do not add product features as part of testing.

## Acceptance criteria

- Build passes.
- Public route smoke checks pass.
- Protected route smoke checks pass.
- Auth session refresh works.
- Critical API routes return safe JSON for missing, invalid, or unauthorized requests.
- Smoke tests are repeatable before every V1 change.

## Definition of done

Phase 2 is complete when there is a reliable baseline check that can detect regressions before and after every stabilization task.

# Phase 3 — Tracker Ingestion Validation

## Objective

Prove the tracker ingestion pipeline works end to end with real production-style data.

## Systems involved

- Public tracker SDK.
- Tracker install snippet.
- `/api/track`.
- API key hashing.
- Bot detection.
- Policy metadata.
- Rate limiting.
- Usage limits.
- Activity log insertion.
- API key last-used updates.

## Implementation goals

- Validate the HTML tracker snippet from a hosted test page.
- Validate manual POST compatibility.
- Validate valid keys succeed.
- Validate invalid, malformed, revoked, and mismatched keys fail.
- Validate event payload fields needed by analytics are stored.
- Validate rate-limit and oversized-payload behavior.
- Validate tracker failures are visible enough for testing.

## Implementation order

1. Generate a real workspace API key.
2. Install the tracker snippet on a hosted test page.
3. Confirm one page event is sent on load.
4. Confirm the event reaches `/api/track`.
5. Confirm the event writes to `activity_logs`.
6. Confirm API key `last_used_at` updates.
7. Test invalid and revoked key cases.
8. Test oversized payload and rate-limit responses.
9. Confirm event appears in Live Stream or Analytics after refresh.

## Dependencies

- Phase 1 migrations and env readiness.
- Phase 2 smoke baseline.
- Working API key generation.
- Test workspace.
- Hosted test page.

## Risks

- CORS changes can break customer-site tracking.
- Tracker validation can become too strict and reject valid customer payloads.
- Rate limits can block normal retries if tuned incorrectly.
- Schema drift can cause inserts to partially fail.

## Files likely involved

- `public/tracker.js`
- `api/track.js`
- `api/_apiKeys.js`
- `api/_crypto.js`
- `api/_botDetection.js`
- `src/lib/botDetection.js`
- `api/_policyEngine.js`
- `api/_usageLimits.js`
- `api/_rateLimit.js`
- `api/_redisRateLimit.js`
- `src/backend/track_ingestion_migration.sql`
- `src/backend/api_key_hashing_migration.sql`
- `src/backend/bot_detection_migration.sql`

## What should remain untouched

- Do not change tracker public method names.
- Do not remove payload aliases.
- Do not weaken API key validation.
- Do not restrict CORS without confirming hosted snippets still work.
- Do not change the core activity log contract casually.

## Acceptance criteria

- Hosted snippet sends a valid event.
- Event writes to Supabase.
- Invalid keys fail with safe 401 responses.
- Missing production env fails clearly, not as fake success.
- Tracker payload remains backward-compatible.
- Live event becomes visible in product data surfaces.

## Definition of done

Phase 3 is complete when the installed tracker can produce a real event that flows through the live ingestion pipeline and rejects unsafe requests correctly.

# Phase 4 — Governance Persistence Unification

## Objective

Make the Governance page use the same persisted policy source of truth already used by the existing live policy infrastructure.

## Systems involved

- Governance page.
- Settings enterprise policy section.
- Team/enterprise API route.
- Policy persistence.
- Server-side policy evaluation.
- Workspace role checks.
- Tracker ingestion metadata.

## Implementation goals

- Load persisted policies on the Governance page.
- Save policy changes through existing server API flow.
- Keep role enforcement server-side.
- Keep UI shape stable.
- Keep network-level blocking out of scope.
- Preserve local development fallback.

## Implementation order

1. Trace the existing Settings policy load/save flow.
2. Reuse that flow in the Governance page.
3. Keep existing visual layout stable.
4. Add minimal loading and error states if missing.
5. Verify owner/admin policy updates persist.
6. Verify analyst/viewer mutation attempts fail.
7. Verify updated policies appear in tracker ingestion metadata.

## Dependencies

- Phase 1 schema readiness.
- Phase 2 smoke checks.
- Phase 3 live ingestion validation.
- Working workspace role checks.

## Risks

- Governance currently mixes local/mock controls with persisted policy concepts.
- Touching too much page state can become a refactor.
- Frontend role display can drift from server authorization.

## Files likely involved

- `src/pages/ControlCenter.jsx`
- `src/pages/Settings.jsx`
- `src/settings/securityUtils.js`
- `src/context/AppContext.jsx`
- `api/app.js`
- `api/_teamRoute.js`
- `api/_policyEngine.js`
- `src/backend/enterprise_security_migration.sql`

## What should remain untouched

- Do not implement hard blocking.
- Do not redesign Governance.
- Do not rewrite Settings.
- Do not change API contracts.
- Do not alter schema unless validation proves it is required.

## Acceptance criteria

- Owner/admin can update Governance policy.
- Policy persists after refresh.
- Viewer/analyst cannot mutate policy.
- Tracker ingestion reflects persisted policy metadata.
- Local development fallback remains usable.

## Definition of done

Phase 4 is complete when Governance, Settings, and ingestion all use the same persisted policy state.

# Phase 5 — Analytics Live-Data Validation

## Objective

Validate that analytics surfaces correctly prioritize real data and fall back safely when live data is unavailable.

## Systems involved

- Analytics summary endpoint.
- Dashboard data model.
- Activity feed.
- Analytics page.
- Rollup tables.
- Raw activity log fallback.
- Investor sample mode.

## Implementation goals

- Confirm empty state when no live data exists and sample mode is disabled.
- Confirm sample preview only appears when enabled and no real data exists.
- Confirm real data overrides sample data.
- Confirm recent activity remains live.
- Confirm rollup-backed summaries preserve UI contracts.
- Confirm cross-workspace leakage is impossible.

## Implementation order

1. Test workspace with no events and sample disabled.
2. Test workspace with no events and sample enabled.
3. Ingest one real tracker event.
4. Confirm UI switches to live data.
5. Confirm Activity shows the raw recent event.
6. Confirm Analytics summary values are correct.
7. Run rollup processing.
8. Confirm rollup-backed data still renders correctly.
9. Test unauthorized workspace access.

## Dependencies

- Phase 3 tracker validation.
- Activity log schema.
- Analytics rollup migration.
- Job runner access if rollups are tested.

## Risks

- Rollup fallback can hide missing migrations.
- Sample preview can confuse validation.
- Raw queries may become slow as event volume grows.
- Analytics response shape changes can break multiple pages.

## Files likely involved

- `src/analytics/analyticsApi.js`
- `src/pages/Dashboard.jsx`
- `src/pages/Activity.jsx`
- `src/pages/Analytics.jsx`
- `api/analytics.js`
- `api/_analyticsSummaryRoute.js`
- `api/_analyticsRollups.js`
- `api/_jobRunner.js`
- `src/backend/analytics_engine_migration.sql`
- `src/backend/analytics_rollups_migration.sql`

## What should remain untouched

- Do not redesign charts.
- Do not remove sample preview mode.
- Do not change response keys without preserving compatibility.
- Do not move heavy raw-log aggregation to the frontend.

## Acceptance criteria

- Empty, sample, raw-live, and rollup-backed states all render safely.
- Live data takes precedence over sample data.
- Recent activity remains fresh.
- Non-member workspace analytics requests are rejected.
- No blank screens occur with partial analytics data.

## Definition of done

Phase 5 is complete when live analytics behavior is predictable, verified, and safe across all supported data states.

# Phase 6 — Settings/API Key/Domain Validation

## Objective

Validate the customer onboarding controls needed to connect a real website.

## Systems involved

- Settings page.
- API key generation and rotation.
- Install snippet generation.
- Domain creation.
- DNS verification.
- Supabase auth/session.
- Workspace roles.
- Plan limits.

## Implementation goals

- Validate first API key generation.
- Validate key rotation and old-key rejection.
- Validate plaintext key is visible once.
- Validate refresh masks the key.
- Validate install snippet uses real workspace and key data.
- Validate domain add and DNS verification.
- Validate role-restricted mutations.
- Validate production does not use local mock success.

## Implementation order

1. Create or use a fresh workspace.
2. Generate the first API key.
3. Copy the install snippet.
4. Refresh and confirm key masking.
5. Rotate the API key.
6. Confirm old key fails tracker ingestion.
7. Add a test domain.
8. Add DNS TXT record.
9. Verify pending, failed, and verified states.
10. Test analyst/viewer mutation denial.

## Dependencies

- Phase 1 migrations.
- Phase 2 smoke tests.
- Phase 3 tracker validation.
- Test domain DNS access.
- Workspace role setup.

## Risks

- Settings is fragile and large.
- DNS propagation delay can look like product failure.
- One-time key reveal can be missed by testers.
- Plan-limit errors need clear messaging.

## Files likely involved

- `src/pages/Settings.jsx`
- `src/settings/securityUtils.js`
- `src/auth/supabaseAuth.js`
- `api/app.js`
- `api/_apiKeyRoute.js`
- `api/_domainRoute.js`
- `api/_verifyDomainRoute.js`
- `api/_auth.js`
- `api/_planLimits.js`
- `src/backend/domain_verification_migration.sql`
- `src/backend/api_key_hashing_migration.sql`

## What should remain untouched

- Do not reveal stored plaintext keys.
- Do not weaken hashing.
- Do not redesign Settings.
- Do not bypass server-side role checks.
- Do not convert local fallback into production fallback.

## Acceptance criteria

- Fresh workspace can generate an API key.
- Snippet is copyable and contains real values while plaintext key is available.
- Refresh masks the key.
- Rotated old key fails ingestion.
- Domain writes to Supabase.
- DNS verification succeeds with the correct TXT record.
- Unauthorized roles receive safe errors.

## Definition of done

Phase 6 is complete when a new customer can connect a domain and tracker credential without operator intervention.

# Phase 7 — Billing & Webhook Validation

## Objective

Validate Stripe-hosted billing flows and subscription sync without enabling unsupported payout workflows.

## Systems involved

- Stripe checkout.
- Stripe billing portal.
- Stripe webhook.
- Workspace billing fields.
- Billing UI state.
- Payout request safety.
- Audit and notification hooks.

## Implementation goals

- Validate Stripe test products and price IDs.
- Validate checkout session creation.
- Validate billing portal session creation.
- Validate webhook signature verification.
- Validate idempotent webhook handling.
- Validate subscription state sync.
- Validate payout requests remain disabled unless explicitly enabled.

## Implementation order

1. Confirm Stripe test products and prices.
2. Configure Stripe env vars.
3. Start checkout from app.
4. Complete test checkout.
5. Deliver webhook.
6. Confirm workspace subscription fields update.
7. Replay webhook and confirm duplicate is ignored.
8. Open billing portal.
9. Confirm payout request disabled behavior.

## Dependencies

- Phase 1 env readiness.
- Supabase workspace data.
- Stripe test dashboard.
- Public webhook URL.

## Risks

- Webhook raw-body handling is easy to break.
- Wrong price IDs can map to wrong plans.
- Billing portal requires a valid Stripe customer.
- Subscription state mapping can affect plan enforcement.

## Files likely involved

- `src/billing/billingApi.js`
- `src/billing/stripeConfig.js`
- `src/pages/Settings.jsx`
- `src/pages/Landing.jsx`
- `api/billing.js`
- `api/_checkoutRoute.js`
- `api/_billingPortalRoute.js`
- `api/_payoutRoute.js`
- `api/stripe-webhook.js`
- `src/backend/billing_migration.sql`
- `src/backend/stripe_webhook_idempotency.sql`

## What should remain untouched

- Do not expose Stripe secrets.
- Do not change webhook signature verification unless it is broken.
- Do not enable live payouts.
- Do not add Stripe Connect.
- Do not trust frontend plan values.

## Acceptance criteria

- Checkout works in Stripe test mode.
- Webhook updates workspace billing state.
- Duplicate webhook is ignored safely.
- Billing portal works for a workspace with customer ID.
- Missing Stripe env returns clear setup errors.
- Payouts remain disabled by default.

## Definition of done

Phase 7 is complete when subscription lifecycle events move safely from Stripe to Supabase and billing actions fail safely when not configured.

# Phase 8 — Production Observability

## Objective

Ensure KtrlAI operators can identify and diagnose production issues across ingestion, billing, jobs, notifications, rate limits, rollups, and admin health.

## Systems involved

- Health endpoint.
- Admin dashboard.
- Audit logs.
- Jobs.
- Notifications.
- Rate limits.
- Rollups.
- Stripe webhook events.
- Internal job runner.

## Implementation goals

- Validate health endpoint output.
- Validate admin-only visibility.
- Validate failed job visibility.
- Validate failed notification visibility.
- Validate rate-limit event visibility.
- Validate webhook event visibility.
- Configure or document job runner execution.
- Create a minimal operator runbook.

## Implementation order

1. Call health endpoint in staging.
2. Confirm health output exposes no secrets.
3. Trigger a controlled failed job.
4. Trigger a controlled notification event.
5. Trigger a controlled rate-limit event.
6. Verify Admin surfaces show each state.
7. Verify internal jobs endpoint protection.
8. Configure Vercel Cron or document manual job processing.
9. Write operator runbook notes.

## Dependencies

- Phase 1 env readiness.
- Phase 2 smoke checks.
- Platform admin user.
- Jobs and notifications migrations.
- Internal job secret.

## Risks

- Health can overstate readiness if fallback modes are misread.
- Admin summary depends on many optional tables.
- Jobs will not process unless scheduled or triggered.
- Excessively detailed errors can leak sensitive information.

## Files likely involved

- `api/health.js`
- `api/admin.js`
- `api/_adminSummaryRoute.js`
- `api/_audit.js`
- `api/_jobs.js`
- `api/_jobRunner.js`
- `api/_notifications.js`
- `api/_rateLimit.js`
- `api/internal/jobs.js`
- `src/pages/Admin.jsx`
- `src/backend/jobs_migration.sql`
- `src/backend/notifications_migration.sql`
- `src/backend/scale_optimization_migration.sql`

## What should remain untouched

- Do not add a new observability vendor yet.
- Do not expose secrets in health or admin responses.
- Do not query platform-wide data from frontend anon client.
- Do not make internal jobs publicly executable.

## Acceptance criteria

- Health endpoint returns safe readiness data.
- Admin loads only for platform admins.
- Failed jobs, notifications, rate limits, rollups, and billing events are visible.
- Internal job runner is protected.
- Operator runbook exists.

## Definition of done

Phase 8 is complete when operators can diagnose the core production systems without database spelunking as the primary workflow.

# Phase 9 — V1 Launch Readiness

## Objective

Complete final go/no-go validation for V1 production release.

## Systems involved

- Full app routing.
- Auth/session.
- Workspace bootstrap.
- Settings onboarding.
- Tracker ingestion.
- Analytics.
- Governance.
- Billing.
- Admin.
- Health.
- Deployment configuration.

## Implementation goals

- Run final build.
- Run full smoke checklist.
- Validate staging.
- Validate production env.
- Validate live tracker event.
- Validate analytics live switch.
- Validate governance persistence.
- Validate Stripe test lifecycle.
- Validate admin and health.
- Produce go/no-go notes.

## Implementation order

1. Run build.
2. Run smoke checks.
3. Validate staging database state.
4. Validate Vercel env vars.
5. Validate signup/login/logout/session refresh.
6. Validate API key, domain, tracker, and analytics loop.
7. Validate governance persistence.
8. Validate Stripe checkout and webhook.
9. Validate admin and health.
10. Produce launch go/no-go report.

## Dependencies

- Completion of phases 1 through 8.
- Staging deployment.
- Test workspace.
- Test domain.
- Stripe test setup.
- Platform admin user.

## Risks

- Partially mock product areas can appear production-real.
- Last-minute UI changes can introduce regressions.
- Missing env vars can break onboarding.
- Unscheduled jobs can leave queue-backed work unprocessed.

## Files likely involved

- `KTRLAI_ARCHITECTURE_AUDIT.md`
- `KTRLAI_V1_EXECUTION_PLAN.md`
- `src/backend/README.md`
- `.env.example`
- `vercel.json`
- `package.json`
- Core files validated in phases 1 through 8.

## What should remain untouched

- Do not redesign.
- Do not refactor large files.
- Do not add new features.
- Do not enable live payouts.
- Do not change API contracts.

## Acceptance criteria

- Build passes.
- Public and protected routes load.
- Auth/session flows work.
- New workspace can generate API key and add domain.
- Tracker event writes live and appears in UI.
- Governance policy persists.
- Stripe checkout and webhook sync work.
- Admin and health surfaces work.
- No frontend or API response exposes secrets.

## Definition of done

Phase 9 is complete when V1 has a written go/no-go result backed by verified production-like behavior across all core loops.

# Recommended Execution Order

## What happens first

1. Migration and environment readiness.
2. Build and smoke-test baseline.
3. API key and tracker ingestion validation.
4. Settings domain/API key validation.

These steps come first because the rest of V1 depends on database readiness, environment correctness, and the ability to ingest real events.

## What can happen in parallel

- Stripe test setup can run while smoke tests are defined.
- Operator runbook notes can start while observability is verified.
- Admin/health checks can run alongside billing validation after env readiness.
- Analytics rollup checks can run while governance persistence is being validated, after at least one live event exists.

## What must be delayed

- Governance persistence changes should wait until tracker ingestion is verified.
- Analytics rollup validation should wait until live events exist.
- Billing launch checks should wait until env readiness is complete.
- Component decomposition should wait until after V1.
- Visual redesign should wait until after V1.
- New monetization, training, or visibility features should wait until after V1 scope lock.

# V1 Scope Lock

## Included in V1

- Supabase auth and session persistence.
- Workspace bootstrap.
- Protected routes.
- Platform admin access checks.
- Secure API key generation and rotation.
- Domain creation and DNS verification.
- Tracker SDK installation.
- Live tracker ingestion.
- AI bot detection metadata.
- Activity logs.
- Dashboard, Activity, and Analytics live-data behavior.
- Governance policy persistence using existing infrastructure.
- Stripe checkout, billing portal, webhook sync, and subscription states.
- Existing plan and usage enforcement.
- Health endpoint.
- Admin operational visibility.
- Internal jobs foundation and protected runner.
- Notification foundation with safe provider fallback.
- Existing docs/help/legal surfaces.

## Postponed to V1.5

- Fully real visibility scans.
- Fully live monetization ledger workflows.
- More complete content licensing workflows.
- More complete production alerting.
- More granular analytics export/reporting.
- Component decomposition of large pages.
- Expanded automated test coverage beyond core smoke paths.
- CSP tuning after provider choices are finalized.

## Postponed to V2

- Network-level crawler blocking.
- Stripe Connect and live payouts.
- Real training data storage and processing.
- External observability platform integration.
- Public API expansion beyond existing route contracts.
- Router replacement.
- State-management replacement.
- Major UI redesign.
- Enterprise SSO or SCIM.

# Immediate Next Engineering Task

Validate the complete SQL migration sequence on a clean Supabase staging project and produce a migration readiness report.

That report should include:

- Which migrations ran successfully.
- Which migrations failed.
- Exact SQL errors, if any.
- Whether existing databases need compatibility SQL.
- Whether all expected tables, columns, enums, indexes, RLS policies, and comments exist.
- Whether Phase 2 smoke testing can begin.

This is the highest-priority next task because every production V1 flow depends on a trustworthy database foundation.

