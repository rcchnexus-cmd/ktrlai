# KtrlAI Phase 2 Smoke Test Report

Date: 2026-05-18

Phase: V1 Phase 2 — Test Coverage & Smoke Tests

Scope: lightweight operational validation for the existing application. No UI redesign, architecture refactor, feature addition, API contract change, or tracker contract change was performed.

## Live Staging Retry - 2026-05-18

Requested task: complete Phase 2 live staging smoke tests using the real Supabase staging environment variables.

Result: blocked in this workspace. The current shell does not have the required staging variables available, so live Supabase-backed auth, session restoration, workspace bootstrap, protected API, and role checks could not be executed safely.

Missing staging variables detected:

| Variable | Status |
| --- | --- |
| `VITE_SUPABASE_URL` | Missing |
| `VITE_SUPABASE_ANON_KEY` | Missing |
| `SUPABASE_URL` | Missing |
| `SUPABASE_SERVICE_ROLE_KEY` | Missing |
| `API_KEY_HASH_SECRET` | Missing |
| `APP_URL` | Missing |

No application code was changed. No live staging result is claimed from this retry. To complete this phase, rerun the smoke suite from a shell/session where the staging Supabase variables are loaded. For full API coverage, include the server-side variables as well as frontend Vite variables.

## Manual Live Staging Validation - 2026-05-18

Manual live staging validation was completed successfully outside this shell using the real Supabase staging environment.

Marked passed:

1. Signup flow.
2. Login flow.
3. Session refresh on `/dashboard`.
4. Protected route redirect.
5. API key generation.
6. Domain creation.
7. Dashboard/activity loading.
8. Live tracker validation basics.

This supersedes the earlier shell-local staging-env blocker for Phase 2 readiness. No application code changes were required for this report update.

## Summary Verdict

Phase 2 baseline validation is complete enough for V1 Phase 3 tracker validation to begin.

Passed:

- Production build.
- API route entrypoint import/syntax checks.
- Vite app startup and deep-link serving.
- Public route HTTP serving.
- Protected route deep-link HTTP serving through SPA fallback.
- Local development auth fallback flow.
- Local and production-mode safe-error behavior for selected API routes.
- Manual live staging signup flow.
- Manual live staging login flow.
- Manual live staging session refresh on `/dashboard`.
- Manual live staging protected route redirect.
- Manual live staging API key generation.
- Manual live staging domain creation.
- Manual live staging dashboard/activity loading.
- Manual live staging tracker validation basics.

No Phase 2 blocker remains for beginning Phase 3 tracker ingestion validation.

## Build and Runtime Validation

### Build command

```bash
npm run build
```

### Build result

Passed.

Observed output:

- Vite built successfully.
- 107 modules transformed.
- Route-level lazy chunks were generated.
- No build errors.

Notable artifact sizes:

- Main JS bundle: `448.50 kB`, gzip `128.77 kB`.
- CSS bundle: `82.48 kB`, gzip `15.89 kB`.
- Settings route chunk: `30.39 kB`, gzip `8.56 kB`.
- Admin route chunk: `22.14 kB`, gzip `4.39 kB`.

No build-time blocker was found.

## API Import and Syntax Validation

### API entrypoints tested

The following API route entrypoints were dynamically imported with Node ESM:

- `api/app.js`
- `api/billing.js`
- `api/analytics.js`
- `api/admin.js`
- `api/health.js`
- `api/track.js`
- `api/stripe-webhook.js`
- `api/internal/jobs.js`

### Result

Passed.

All tested API entrypoints imported successfully without syntax/import crashes.

## Tested Routes

A Vite dev server was started on `http://127.0.0.1:5173` and the following routes were requested over HTTP.

This validates app startup, dev-server serving, and SPA deep-link fallback. It does not fully validate browser-side React rendering or protected-route redirects.

| Route | HTTP status | SPA root present |
| --- | ---: | --- |
| `/` | 200 | Yes |
| `/login` | 200 | Yes |
| `/signup` | 200 | Yes |
| `/forgot-password` | 200 | Yes |
| `/docs` | 200 | Yes |
| `/docs/install` | 200 | Yes |
| `/docs/sdk` | 200 | Yes |
| `/docs/analytics` | 200 | Yes |
| `/docs/billing` | 200 | Yes |
| `/help` | 200 | Yes |
| `/privacy` | 200 | Yes |
| `/terms` | 200 | Yes |
| `/security` | 200 | Yes |
| `/contact` | 200 | Yes |
| `/dashboard` | 200 | Yes |
| `/activity` | 200 | Yes |
| `/control` | 200 | Yes |
| `/visibility` | 200 | Yes |
| `/analytics` | 200 | Yes |
| `/monetization` | 200 | Yes |
| `/training` | 200 | Yes |
| `/settings` | 200 | Yes |
| `/admin` | 200 | Yes |

## Tested Auth Flows

### Local fallback auth test

The auth adapter was exercised in local fallback mode because no Supabase frontend env vars are configured in this shell.

Tested:

- `getInitialSession()`
- `login({ email, password })`
- `logout()`

Result:

- Initial session returned logged-out mock mode.
- Login returned authenticated mock session with demo workspace and owner role.
- Logout returned logged-out mock mode.

Observed result:

```json
{"initialMode":"mock","isAuthenticated":false,"isRestoring":false}
{"loginMode":"mock","isAuthenticated":true,"workspaceId":"demo","role":"owner"}
{"logoutMode":"mock","isAuthenticated":false,"isRestoring":false}
```

### Real Supabase auth test

Passed by manual live staging validation.

Confirmed:

- Signup flow completed successfully.
- Login flow completed successfully.
- Authenticated dashboard access worked after login.

## Protected Route Behavior

### Static behavior confirmed

The protected route guard remains centralized in `src/App.jsx`.

Expected behavior:

- Protected routes are listed in a protected route set.
- When auth restoration is pending, the app shows `Restoring session...`.
- When unauthenticated, the intended route is written to `localStorage` as `ktrlai_intended_route`.
- The app navigates to `/login`.
- After login, auth pages read the intended route and redirect appropriately.

### HTTP deep-link behavior confirmed

Protected route deep links all returned the SPA document with `200` status through the dev server. This confirms deep links do not 404 at the server/fallback layer.

### Browser redirect behavior

Passed by manual live staging validation.

Confirmed:

- Protected route redirect worked for unauthenticated access.
- Authenticated access restored the expected protected workspace experience.

## Session Restoration Behavior

### Local fallback session restoration

Passed for local mock mode.

`getInitialSession()` returned a stable logged-out local mock session when Supabase is not configured.

### Real Supabase session restoration

Passed by manual live staging validation.

Confirmed:

- Refresh on `/dashboard` preserved the authenticated session.
- The protected dashboard loaded after refresh.

## Workspace Bootstrap Behavior

Passed at flow level by manual live staging validation.

Confirmed:

- Signup completed successfully against live staging.
- Dashboard/activity loading worked after authenticated access.
- Session refresh on `/dashboard` remained stable.

Recommended follow-up for Phase 2 archive completeness:

- Spot-check staging rows for `profiles`, `workspaces`, `workspace_members`, `monetization_settings`, and `training_permissions`.
- Confirm bootstrap did not duplicate rows after refresh/login.

## Tested API Flows

### Grouped API unsupported action behavior

Tested:

- `/api/app?action=missing`

Result:

```json
{"status":400,"body":{"ok":false,"message":"Unsupported app API action."}}
```

Pass.

### Local API key route behavior without backend env

Tested:

- `/api/app?action=api-key`
- Local runtime.
- Missing Supabase admin/hash env.

Result:

```json
{
  "status": 202,
  "body": {
    "ok": true,
    "mode": "mock",
    "message": "API key generated in local development mode. Configure Supabase admin and API_KEY_HASH_SECRET for persisted keys."
  }
}
```

Pass for local development fallback only.

This is not considered production validation.

### Production-mode API key behavior without backend env

Tested with `NODE_ENV=production`:

- `/api/app?action=api-key`
- Missing Supabase admin/hash env.

Result:

```json
{"status":500,"body":{"ok":false,"mode":"live","message":"Server configuration missing."}}
```

Pass.

Production mode does not silently mock success.

### Tracker endpoint missing key behavior

Tested:

- `/api/track`
- Empty body.

Result:

```json
{"status":401,"body":{"ok":false,"message":"Missing API key."}}
```

Pass.

### Tracker endpoint production missing env behavior

Tested with `NODE_ENV=production`:

- `/api/track`
- Valid-looking workspace ID, API key, URL, user agent, timestamp.
- Missing Supabase admin/hash env.

Result:

```json
{"status":500,"body":{"ok":false,"mode":"live","message":"Server configuration missing."}}
```

Pass.

Production mode does not mock tracker success when required server env is missing.

### Analytics endpoint without backend env

Tested:

- `/api/analytics?action=summary`
- Missing Supabase admin env.

Result:

```json
{"status":500,"body":{"ok":false,"mode":"live","message":"Server configuration missing."}}
```

Pass for safe missing-env behavior.

Real unauthorized behavior with configured Supabase still needs staging validation.

### Admin endpoint without backend env

Tested:

- `/api/admin?action=summary`
- Missing Supabase admin env.

Result:

```json
{"status":500,"body":{"ok":false,"mode":"live","message":"Server configuration missing."}}
```

Pass for safe missing-env behavior.

Real unauthorized behavior with configured Supabase still needs staging validation.

### Billing checkout unsupported input

Tested:

- `/api/billing?action=checkout`
- Invalid/missing supported billing plan shape.

Result:

```json
{"status":400,"body":{"ok":false,"mode":"live","message":"Unsupported billing plan."}}
```

Pass.

### Internal jobs endpoint without secret/env

Tested:

- `/api/internal/jobs`
- Missing internal job runner secret.

Result:

```json
{"status":500,"body":{"ok":false,"message":"Internal job runner secret is not configured."}}
```

Pass for safe missing-secret behavior.

### Health endpoint

Tested:

- `/api/health`

Result:

- Status `503`.
- `ok: false`.
- `status: degraded`.
- Supabase, Stripe, tracker hash, analytics rollups, and jobs correctly reported as not configured.
- Rate limit reported memory fallback.
- No secret values exposed.

Pass.

## Unauthorized Access Validation

Validated in this pass:

- Tracker missing API key returns `401`.
- Unsupported grouped API action returns `400`.
- Production-mode missing server configuration returns `500` and does not mock success.
- Internal jobs endpoint does not run without configured secret.

Not yet validated:

- Real Supabase bearer-token absence with configured backend.
- Invalid bearer token with configured backend.
- Non-member workspace access.
- Viewer/analyst mutation denial.
- Non-admin `/api/admin?action=summary` denial.

These require a configured staging Supabase environment and test users.

## Frontend/Backend Compatibility Findings

Confirmed:

- Frontend build compiles against current API/client modules.
- Public and protected deep links are served by the SPA.
- API grouped route entrypoints import cleanly.
- Local fallback auth still works.
- Production-mode server routes tested here do not silently fall back when critical server env is missing.

Not confirmed:

- Frontend Supabase anon client compatibility with staging.
- Serverless Supabase admin compatibility with staging.
- Real session restoration after refresh.
- Real workspace bootstrap.
- Real role-based route/API behavior.

## Blockers Discovered

No active Phase 2 blockers remain after manual live staging validation.

Previously blocked live staging items were completed manually:

- Signup flow.
- Login flow.
- Session refresh on `/dashboard`.
- Protected route redirect.
- API key generation.
- Domain creation.
- Dashboard/activity loading.
- Live tracker validation basics.

## Fixes Required

No application code fixes were required from the checks completed in this pass.

No Phase 2 code fixes are required before Phase 3.

## Whether Phase 3 Tracker Validation Can Safely Begin

Yes.

Phase 3 tracker ingestion validation can safely begin.

Reason:

- Build/API/static/local fallback baseline is good.
- Manual live staging auth/session/protected-route checks passed.
- API key generation passed in live staging.
- Domain creation passed in live staging.
- Dashboard/activity loading passed in live staging.
- Live tracker validation basics passed.

## Commands Run

```bash
npm run build
```

```bash
node -e "import API entrypoints"
```

```text
Vite dev server route HTTP checks on http://127.0.0.1:5173
```

```text
Mocked API handler safe-error probes
```

```text
Local fallback auth adapter probe
```

## Files Modified

Created:

- `KTRLAI_PHASE2_SMOKE_TEST_REPORT.md`

No production application code was modified.
