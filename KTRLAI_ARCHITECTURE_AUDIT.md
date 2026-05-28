# KtrlAI Architecture Audit

Date: 2026-05-18

Scope: repository inspection only. No application code was refactored, deleted, or feature-modified for this audit. The only intended output is this report.

Note: the working tree already had uncommitted changes in `src/pages/Landing.jsx` and `src/styles.css` before this audit file was created. They appear to be from the recent visual reset work and were not modified by this audit.

## Executive Summary

KtrlAI is now a substantial React/Vite SaaS application with a hybrid production foundation:

- Frontend: React 19, Vite, custom lightweight router, AppContext state layer, route-level lazy loading, global CSS.
- Auth: Supabase auth with local mock fallback for development.
- Backend: Vercel serverless functions grouped under a small number of route entry files to fit Hobby limits.
- Data: Supabase schema plus many migration files for billing, tracking, admin, jobs, notifications, rate limits, enterprise roles, and analytics rollups.
- Ingestion: production-oriented tracker SDK and `/api/track` endpoint with hashed API key validation, bot detection, policy metadata, usage checks, and live activity insertion.
- Billing: Stripe checkout, billing portal, webhook idempotency, workspace subscription sync.
- Admin: platform-admin-only infrastructure dashboard backed by a server-only admin summary API.
- Mock/demo surfaces still exist, mostly for local development, investor sample analytics, and unfinished product areas like visibility scans, training uploads, and parts of monetization.

The architecture is extendable, but the app has grown quickly. The largest risks are split live/mock behavior, large centralized CSS, a very large Settings page, a large AppContext, and governance/monetization surfaces that look production-like while some actions remain mock or placeholder-backed.

## 1. Current Folder Structure

Top-level repository:

```text
.
├── api/
│   ├── admin.js
│   ├── analytics.js
│   ├── app.js
│   ├── billing.js
│   ├── health.js
│   ├── stripe-webhook.js
│   ├── track.js
│   ├── internal/
│   │   └── jobs.js
│   └── _*.js server-only helpers
├── public/
│   └── tracker.js
├── src/
│   ├── admin/
│   ├── analytics/
│   ├── api/
│   ├── auth/
│   ├── backend/
│   ├── billing/
│   ├── components/
│   ├── config/
│   ├── context/
│   ├── email/
│   ├── lib/
│   ├── pages/
│   ├── settings/
│   ├── App.jsx
│   ├── main.jsx
│   ├── navigation.jsx
│   └── styles.css
├── .env.example
├── .gitignore
├── index.html
├── package.json
├── package-lock.json
├── vercel.json
└── vite.config.js
```

Generated or dependency folders are present locally:

- `node_modules/`
- `dist/`

Both are ignored by `.gitignore`.

Important backend SQL inventory in `src/backend/`:

- `schema.sql`
- `billing_migration.sql`
- `domain_api_key_comments.sql`
- `track_ingestion_migration.sql`
- `api_key_hashing_migration.sql`
- `domain_verification_migration.sql`
- `pre_production_hardening.sql`
- `admin_dashboard_migration.sql`
- `stripe_webhook_idempotency.sql`
- `analytics_engine_migration.sql`
- `bot_detection_migration.sql`
- `analytics_rollups_migration.sql`
- `enterprise_security_migration.sql`
- `scale_optimization_migration.sql`
- `jobs_migration.sql`
- `notifications_migration.sql`
- `README.md`

## 2. Existing Pages and Routes

Routing is implemented in `src/App.jsx` using React lazy imports and the custom router in `src/navigation.jsx`.

Public routes:

| Route | Page |
| --- | --- |
| `/` | Landing |
| `/login` | Login |
| `/signup` | Signup |
| `/forgot-password` | Forgot password |
| `/docs` | Docs overview |
| `/docs/install` | Install docs |
| `/docs/sdk` | SDK docs |
| `/docs/analytics` | Analytics docs |
| `/docs/billing` | Billing docs |
| `/help` | Help |
| `/privacy` | Privacy |
| `/terms` | Terms |
| `/security` | Security |
| `/contact` | Contact |

Protected workspace routes:

| Route | Current visible product language |
| --- | --- |
| `/dashboard` | Operations |
| `/activity` | Live Stream |
| `/control` | Governance |
| `/visibility` | Visibility |
| `/analytics` | Traffic Intelligence |
| `/monetization` | Licensing Readiness |
| `/training` | AI Training |
| `/settings` | Configuration |
| `/admin` | Infrastructure |

Protected route behavior:

- If auth restoration is pending, the app shows a loading state.
- If unauthenticated, the route is saved to `localStorage` as `ktrlai_intended_route` and navigation redirects to `/login`.
- Login redirects to the intended route or `/dashboard`.
- `/admin` additionally depends on platform admin access checks and is hidden from normal users in the app shell.

Serverless API route entry files:

| Route file | Purpose |
| --- | --- |
| `api/track.js` | Public tracker ingestion |
| `api/app.js` | Grouped app operations: API keys, domains, team, audit, notifications, domain verification |
| `api/billing.js` | Grouped billing operations: checkout, billing portal, payout requests |
| `api/analytics.js` | Workspace analytics summary |
| `api/admin.js` | Platform admin summary |
| `api/health.js` | Health/readiness endpoint |
| `api/stripe-webhook.js` | Stripe webhooks with raw-body signature verification |
| `api/internal/jobs.js` | Internal job runner |

`vercel.json` rewrites `/api/(.*)` to API routes before the SPA fallback, then rewrites all other deep links to `index.html`.

## 3. Existing Components

Core shell and brand components:

- `AppShell.jsx` - authenticated app layout, sidebar, mobile drawer, topbar, logout.
- `MarketingNav.jsx` - public site navigation.
- `Footer.jsx` - marketing/docs/legal footer.
- `Logo.jsx` - KtrlAI mark and wordmark.

Reusable UI/data components:

- `MetricCard.jsx`
- `StatusBadge.jsx`
- `Charts.jsx`
- `SetupGuide.jsx`
- `ProductHint.jsx`
- `ErrorBoundary.jsx`

Observations:

- Componentization is strongest around shell, basic metrics, status badges, charts, and onboarding hints.
- Several pages still contain substantial inline UI structure rather than smaller page-specific components.
- `Settings.jsx` and `Admin.jsx` are especially large and could eventually benefit from decomposition, but they should not be broken apart casually because they coordinate many live/fallback flows.

## 4. Existing State Management

Global app state is in `src/context/AppContext.jsx`.

State structure:

- `dashboard`
- `activity`
- `activityMeta`
- `controls`
- `visibility`
- `analytics`
- `monetization`
- `training`
- `settings`
- `loading`
- `errors`
- `auth`

Auth state:

- `isRestoring`
- `isAuthenticated`
- `user`
- `workspace`
- `workspaceId`
- `mode`
- `isPlatformAdmin`
- `isCheckingPlatformAdmin`

State tools:

- `useReducer` for global app state updates.
- Context provider exposes stable `actions` via `useMemo`.
- Local page state is used for forms, filters, UI tabs, copied states, loading messages, and local overrides.
- Custom navigation is provided by `NavigationProvider`, `useNavigation`, and `RouteLink`.

Auth service:

- `src/auth/supabaseAuth.js` is the main auth adapter.
- `src/auth/mockAuth.js` is local/mock fallback.
- `src/lib/supabaseClient.js` creates the browser Supabase client using only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

Current state architecture is workable, but AppContext has become broad. It owns auth, analytics, settings, mock fallbacks, visibility, controls, training, monetization, and admin checks. Future V1 work should avoid adding much more responsibility there without extracting feature-level hooks or services.

## 5. Existing Mock API and Data Files

Primary mock/demo files:

- `src/api/mockApi.js`
- `src/auth/mockAuth.js`
- mock/sample helpers inside `src/analytics/analyticsApi.js`
- local fallback helpers in `src/settings/securityUtils.js`
- local fallback behavior in `src/billing/billingApi.js`

`mockApi.js` includes sample data for:

- Dashboard KPI cards, traffic series, bot distribution, recent activity.
- AI activity logs.
- Control rules and governance policies.
- Visibility providers and suggested queries.
- Analytics trends, top pages, bot frequency, source distribution.
- Monetization settings, revenue, earnings ledger, payout requests, deals.
- Training permissions, uploaded training files, output preview.
- Settings workspace ID, tracker script, domains, API key metadata, account, notification preferences.

Runtime gating:

- `src/config/runtime.js` defines `allowLocalMockFallback = !import.meta.env.PROD`.
- `VITE_SHOW_INVESTOR_SAMPLE_DATA` controls investor sample dashboard/analytics previews when no real events exist.

Important distinction:

- Local mock fallback remains useful for development.
- Production paths are expected to require Supabase/server env vars and return clear setup errors rather than silently succeeding.
- Investor sample data can still appear in UI if enabled and no real analytics exist.

## 6. Existing Dashboard Analytics

Frontend analytics flow:

- `src/analytics/analyticsApi.js` fetches `/api/analytics?action=summary`.
- It requires a Supabase access token.
- It transforms backend responses into Dashboard, Analytics, and Activity view models.
- It decorates empty or sample states with labels like `Live data`, `Sample preview`, or `Awaiting tracking data`.

Backend analytics flow:

- `api/analytics.js` dispatches to `api/_analyticsSummaryRoute.js`.
- The route requires workspace membership via bearer token.
- It supports `range=7d`, `30d`, and `90d`.
- It uses rollup tables where possible.
- It falls back to raw `activity_logs` queries when rollups are missing/unavailable.
- Recent activity remains raw-log based to preserve a live feel.

Dashboard behavior:

- Dashboard loads analytics through `actions.loadDashboard()`.
- It polls approximately every 45 seconds while visible.
- It falls back to investor sample or empty mode depending on config and data availability.
- It also loads settings/install health for onboarding and tracker state.

Current analytics returned include:

- Total events.
- Unique bots/systems.
- Pages accessed.
- Bot distribution.
- Traffic over time.
- Recent activity.
- Top pages.
- Allowed/blocked/governed counts.
- AI detection insights.
- Install health.
- Revenue estimate placeholder.
- `hasRealData` and source metadata.

## 7. Existing AI Activity Logic

SDK/browser side:

- `public/tracker.js` exposes `window.KtrlAI`.
- Methods include `init()`, `track()`, `identify()`, `page()`, and `flush()`.
- It reads `data-workspace-id`, `data-api-key`, and optional `data-endpoint`.
- It queues events asynchronously.
- It tracks initial page load and SPA route changes.
- It deduplicates near-identical events.
- It caps queue and retry behavior to protect host websites.

Ingestion endpoint:

- `api/track.js` accepts POST and OPTIONS.
- It supports tolerant payload field names such as `workspaceId`, `workspace_id`, `apiKey`, `api_key`, `pageUrl`, and `url`.
- Required production inputs are a valid workspace ID, a valid API key format, and a valid HTTP/HTTPS page URL.
- It validates hashed API keys server-side using `API_KEY_HASH_SECRET`.
- It rejects missing, invalid, revoked, or hash-mismatched keys.
- It applies rate limiting and plan usage checks.
- It enriches the event through bot detection.
- It evaluates governance policy metadata.
- It inserts into `activity_logs`.
- It updates `api_keys.last_used_at`.
- It can enqueue/send install verified and suspicious crawler notifications.

Bot detection:

- Shared frontend/server detection logic is in `src/lib/botDetection.js`.
- Server helper `api/_botDetection.js` reuses that detection engine.
- Detection returns bot/operator name, bot type, category, confidence score, AI/search/suspicious flags, and detection method.
- Known AI/search/social/scraper signatures are supported.

Activity UI:

- `src/pages/Activity.jsx` renders a log-style live stream.
- It supports search plus bot type, status, and date filters.
- It loads real recent activity through analytics API where available and falls back through AppContext behavior.

## 8. Existing Policy and Control Logic

There are two separate policy surfaces:

1. `src/pages/ControlCenter.jsx`
   - Loads `state.controls` from `mockApi.getControls()`.
   - Toggle rules update mock state through AppContext.
   - Custom rule builder adds mock custom rules.
   - Crawler matrix uses local `policyOverrides` only in the browser session.
   - This page is currently more of a governance visualization/control mock than a fully live persistence surface.

2. Settings enterprise governance section
   - `src/pages/Settings.jsx` loads enterprise settings through `/api/app?action=team`.
   - `saveGovernancePolicy()` in `src/settings/securityUtils.js` persists policy changes through the grouped app API.
   - This is the more production-ready policy persistence path.

Server-side policy evaluation:

- `api/_policyEngine.js` maps bot detection categories to default policies.
- It looks up workspace `ai_policies` by candidate bot scopes.
- It returns policy metadata with `enforcement: "visibility_only"`.
- It does not perform network-level blocking yet.

Current gap:

- The main Governance route and the Settings governance section are not fully unified. The tracker ingestion path can evaluate persisted policies, but the visible Control Center page still relies heavily on mock/local state.

## 9. Existing Monetization Logic

Billing:

- `src/billing/stripeConfig.js` defines Free, Pro, and Business plan metadata.
- `src/billing/billingApi.js` calls `/api/billing?action=checkout`, `/api/billing?action=portal`, and `/api/billing?action=payout`.
- Stripe secret keys are server-only.
- Checkout and portal require Supabase bearer token and owner/admin workspace authorization.
- `api/stripe-webhook.js` verifies Stripe signatures, stores processed webhook event IDs, and syncs workspace plan/subscription fields.

Monetization page:

- `src/pages/Monetization.jsx` loads `state.monetization` from `mockApi.getMonetization()`.
- It shows cleared/pending/projected revenue, earnings ledger, payout requests, paid access toggle, pricing rules, and deal table.
- `actions.updateMonetization()` updates mock monetization settings.
- `actions.requestPayout()` attempts the real payout endpoint, but payout execution remains disabled unless `PAYOUT_REQUESTS_ENABLED=true`; local fallback may use mock behavior.

Database/backend foundation:

- Migrations include monetization settings, earnings ledger, payout requests, billing fields, Stripe webhook events, and plan enforcement support.

Current gap:

- Billing subscriptions are production-oriented.
- Monetization/business-value modeling is not fully production-real yet. Revenue, deals, paid access pricing, and many ledger views are still sample/mock or placeholder-backed unless real ledger rows are created through future workflows.

## 10. Existing Settings and Install Script Logic

`src/pages/Settings.jsx` is the largest page and coordinates many flows:

- Installation wizard and tracker health.
- API key management.
- Domain verification.
- Team management.
- Governance policies.
- Audit logs.
- Security posture.
- Notification preferences.
- Billing and subscription state.
- Account settings.

Installation:

- Install snippets are generated for HTML, React/Vite, Next.js, WordPress, Webflow, and Shopify.
- Snippets include `data-workspace-id`, `data-api-key`, and `data-endpoint`.
- If the plaintext API key is not available, snippets use `ktrl_live_your_key` and explain that the user must generate/rotate a key.
- Install health is fetched through analytics install health support and polled about every 45 seconds.

API key management:

- Production path calls `/api/app?action=api-key`.
- The server generates `ktrl_live_...` keys, stores only hash/prefix metadata, and returns plaintext once.
- After refresh, the UI only shows masked key metadata.
- Local fallback can generate a mock key when backend env is unavailable.

Domain management:

- Production path calls Supabase-backed domain creation through `authService.addDomain()`.
- DNS verification calls `/api/app?action=verify-domain`.
- Local fallback can accept mock verification when allowed.

Billing:

- Checkout and billing portal actions call grouped billing endpoints.
- Subscription warnings are shown for problem states.

Enterprise/security:

- Team, governance policy, audit, notification settings are backed by `/api/app?action=team`, `/api/app?action=audit`, and `/api/app?action=notification` where available.

## 11. What Is Stable

Stable foundations:

- React/Vite app startup and route lazy loading.
- Custom SPA deep-link support through `vercel.json`.
- Supabase browser client uses only anon key.
- Server-only Supabase admin client is isolated under `api/`.
- Supabase auth/session restoration and workspace bootstrap are implemented.
- Protected workspace routes are centralized in `App.jsx`.
- Admin visibility is protected by a server-side platform-admin check.
- API route grouping keeps Vercel Hobby function count low.
- `/api/track` is production-oriented and security-aware.
- Hashed API key validation is server-side.
- Tracker SDK has production safeguards: queue cap, duplicate prevention, retry cap, SPA route tracking.
- Stripe webhook signature verification and idempotency are present.
- Billing portal/checkout endpoints require authenticated workspace owner/admin roles.
- Domain verification uses server-side DNS TXT lookup in live mode.
- Rate limiting has a Redis/Upstash provider abstraction and memory fallback.
- Jobs and notifications have server-side foundations.
- Analytics rollup infrastructure exists with raw-query fallback.
- `src/backend/README.md` documents migration order and required env vars.
- `.gitignore` protects `.env`, `.vercel`, `dist`, and `node_modules`.

## 12. What Is Fragile

Fragile or high-risk areas:

- `src/styles.css` is very large and centralized. Global selectors and legacy theme layers can create visual regressions across many screens.
- `src/pages/Settings.jsx` is extremely large and coordinates many unrelated concerns. Small changes can affect installation, billing, domains, API keys, team management, notifications, and security UI.
- `src/context/AppContext.jsx` owns too many feature domains. Adding more global state can increase coupling.
- The custom router is simple and dependency-light, but it lacks the guardrails of a mature router library.
- Live/mock fallback behavior is spread across AppContext, auth, billing, settings utilities, and mockApi. It works, but it requires discipline to avoid production paths accidentally behaving like local development.
- Control Center and Settings governance are split. One is mostly mock/local, while the other persists policies through server APIs.
- Dashboard health indicators mix live analytics/install health with some UI-level status assumptions.
- Analytics rollup fallback is intentionally tolerant, but that means missing migrations can be hidden by raw-query fallback until scale issues appear.
- Admin summary is broad and complex. It depends on many optional tables and uses safe fallbacks, which is good for uptime but can mask incomplete migrations.
- Several SQL migrations are additive and ordered, but there is no automated migration runner in the repo.

## 13. What Is Mock or Demo Only

Mock/demo-only or partially mock areas:

- `src/api/mockApi.js` sample dashboard, analytics, controls, visibility, training, monetization, settings defaults.
- `src/auth/mockAuth.js` local authentication fallback.
- Investor sample analytics and dashboard data when `VITE_SHOW_INVESTOR_SAMPLE_DATA=true` and no real events exist.
- Visibility scan results in `/visibility`.
- Training permissions upload/output preview in `/training`.
- Main Control Center rule toggles and rule builder.
- Control Center crawler matrix local overrides.
- Monetization page revenue controls, pricing model toggles, deals, and much of ledger/revenue display.
- Payout request UI is server-ready, but live payout execution is intentionally disabled.
- Some Dashboard/System Health UI labels are operational placeholders unless backed by health/admin endpoints in a future integration.
- Email provider can run as noop/console when no real provider env is configured.
- Redis rate limiting falls back to memory when Upstash env is missing.

## 14. What Can Be Extended Safely

Safe extension paths:

- Add new frontend pages via `src/App.jsx` lazy imports and `src/navigation.jsx`.
- Add new grouped app operations under `api/app.js` by adding a server-only route helper.
- Add billing operations under `api/billing.js` without creating new top-level serverless functions.
- Extend analytics response fields if old keys are preserved.
- Extend bot signatures in `src/lib/botDetection.js`.
- Add SQL migrations in `src/backend/` and document order in `src/backend/README.md`.
- Add additional rollup jobs through the existing jobs infrastructure.
- Add notification event types through server-side notification helpers.
- Improve page componentization by extracting local components from large pages without changing data contracts.
- Extend Settings sections if role checks and fallback behavior remain intact.
- Add tests around API route helpers and frontend transforms.

## 15. What Should Not Be Touched Casually

Do not touch without a focused plan and verification:

- `api/track.js` payload compatibility, CORS behavior, API key validation, and activity log insert shape.
- `public/tracker.js` public SDK API and data attributes.
- `api/stripe-webhook.js` raw body handling, signature verification, and idempotency.
- `api/_crypto.js` and `API_KEY_HASH_SECRET` logic.
- `api/_supabaseAdmin.js` and server-only service role usage.
- `src/lib/supabaseClient.js` frontend anon-only client boundary.
- Auth bootstrap in `src/auth/supabaseAuth.js`, especially workspace/profile/member creation and session readiness.
- RLS assumptions in `src/backend/schema.sql` and enterprise role migrations.
- `vercel.json` API-before-SPA rewrite ordering.
- API route consolidation files: `api/app.js`, `api/billing.js`, `api/admin.js`, `api/analytics.js`.
- `src/settings/securityUtils.js` production/local fallback flags.
- Existing environment variable names in `.env.example`.
- Migration order in `src/backend/README.md`.

## 16. Missing for KtrlAI V1 Production Foundation

High-priority V1 foundation gaps:

1. Automated migration discipline
   - The repo has SQL files and documented order, but no automated migration runner or CI verification.
   - V1 needs a repeatable process for applying migrations safely to staging and production.

2. Production test coverage
   - Add API route tests for auth/roles, `/api/track`, billing, domain, API key, analytics, admin, jobs, and health.
   - Add browser smoke tests for login, signup, protected redirects, settings install, API key generation, and tracker event appearance.

3. Governance persistence unification
   - Control Center should eventually use the same live `ai_policies` model as Settings.
   - Current Control Center rule toggles and builder are mostly mock/local.

4. Real visibility scanning
   - `/visibility` currently behaves like a productized mock scan.
   - V1 needs real checks or a clearly scoped beta implementation.

5. Real monetization ledger workflows
   - Stripe subscriptions are real-ready, but content licensing revenue, paid access pricing, and deals are not fully live workflows.
   - Payouts remain disabled and should stay disabled until Stripe Connect/compliance/reconciliation work is complete.

6. Training data backend
   - Training upload, dataset permissions, and output preview are UI/mock oriented.
   - V1 needs storage, file validation, permissions, and deletion/export rules if this remains in product scope.

7. Production observability
   - Add real logging, alerting, and dashboards for API errors, webhook failures, tracker ingestion failures, queue failures, and rate-limit spikes.

8. Health-to-UI integration
   - The app has `/api/health`, but Dashboard/System Health UI should consume live health where appropriate rather than relying on static or derived UI status.

9. Queue scheduling
   - Jobs infrastructure exists, but V1 needs Vercel Cron or another internal trigger configured with `INTERNAL_JOBS_SECRET`.

10. Email provider activation
   - Provider abstraction and notification logs exist.
   - V1 needs a selected provider, verified sender/domain, templates, and deliverability testing.

11. Redis/Upstash production decision
   - Memory fallback is useful but not ideal for serverless production abuse control.
   - V1 should configure Upstash or explicitly accept fallback limitations.

12. Security headers and CSP validation
   - `vercel.json` includes CSP and security headers.
   - V1 should verify the CSP does not block Supabase, Stripe, tracker, docs snippets, analytics, or future provider assets.

13. CORS policy hardening
   - `/api/track` intentionally accepts cross-site requests.
   - V1 should confirm origin strategy, allowed headers, and abuse safeguards for public tracker use.

14. Legal and support readiness
   - Privacy, terms, security, help, and contact pages exist.
   - V1 needs legal review and real support/contact routing.

15. Component decomposition
   - Large pages, especially Settings and Admin, should be split after behavior is stable.
   - This is maintainability work, not a launch blocker if thoroughly tested.

16. End-to-end production checklist
   - Supabase project configured.
   - All migrations applied in order.
   - Vercel env vars set.
   - Stripe products/prices/webhook configured.
   - Upstash/env configured or memory fallback accepted.
   - Email provider configured or noop behavior accepted.
   - Internal jobs cron configured.
   - First workspace admin seeded.
   - Tracker installed on a real test site.
   - API key rotation and domain verification tested live.

## Current Architecture Diagram

```text
Browser app
  |
  |-- React/Vite SPA
  |   |-- AppContext
  |   |-- custom navigation
  |   |-- Supabase anon auth client
  |   |-- public/docs/auth/app pages
  |
  |-- public/tracker.js on customer sites
      |
      v
Vercel API routes
  |
  |-- /api/track
  |   |-- API key hash validation
  |   |-- bot detection
  |   |-- policy metadata
  |   |-- usage/rate limits
  |   `-- activity_logs insert
  |
  |-- /api/app
  |   |-- api-key
  |   |-- domain
  |   |-- verify-domain
  |   |-- team
  |   |-- audit
  |   `-- notification
  |
  |-- /api/billing
  |   |-- checkout
  |   |-- billing portal
  |   `-- payout request
  |
  |-- /api/analytics
  |   `-- workspace analytics summary
  |
  |-- /api/admin
  |   `-- platform admin summary
  |
  |-- /api/stripe-webhook
  |   `-- subscription sync
  |
  |-- /api/internal/jobs
  |   `-- queue processing
  |
  `-- /api/health

Supabase
  |
  |-- auth users
  |-- profiles
  |-- workspaces
  |-- workspace_members
  |-- domains
  |-- api_keys
  |-- activity_logs
  |-- analytics rollups
  |-- billing/subscription fields
  |-- audit logs
  |-- jobs
  |-- notifications
  `-- platform_admins
```

## Production Readiness Assessment

Overall architecture status: strong private-beta foundation, not fully V1-complete.

Ready or close to ready:

- Auth/session/workspace bootstrap.
- Protected routes.
- Tracker SDK and ingestion endpoint.
- Server-side API key hashing.
- Domain verification endpoint.
- Stripe checkout/portal/webhook foundation.
- Admin read dashboard.
- Analytics summary with rollup fallback.
- Health endpoint.
- Docs/help/legal page surface.

Needs work before a confident public V1:

- Test coverage and migration automation.
- Real Control Center persistence.
- Real visibility scans.
- Real monetization/licensing workflows.
- Real training backend or reduced product scope.
- Production observability and alerting.
- Queue scheduling.
- Email provider activation.
- Redis-backed rate limiting configured.
- Legal/security review.

## Recommended Next Steps

1. Freeze architecture-sensitive files until the current visual/theme direction is stable.
2. Add a CI smoke suite before further major UI changes.
3. Validate all SQL migrations on a clean Supabase staging project.
4. Create an API route test harness for grouped routes.
5. Unify Governance page policy state with the live `ai_policies` backend.
6. Decide whether Visibility, Training, and Monetization are V1 live features or beta/demo sections.
7. Configure staging env vars and run a full live tracker ingestion test from a real hosted page.
8. Add production observability for tracker errors, Stripe webhook failures, Supabase write failures, and queue failures.

