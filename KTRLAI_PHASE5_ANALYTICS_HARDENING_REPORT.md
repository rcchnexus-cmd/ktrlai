# KtrlAI Phase 5 Analytics Hardening Report

Date: 2026-05-18

Phase: V1 Phase 5 - Analytics Hardening & Live-Data Validation

Scope: audit and harden analytics/dashboard/activity data-source selection so real live workspace data takes precedence over investor sample or preview data. No dashboard redesign, route changes, tracker contract changes, analytics API contract changes, event schema changes, or broad architecture refactors were performed.

## Summary Verdict

Phase 5 application hardening is complete.

The main issue found was that frontend sample-data selection only checked `summary.hasRealData`. That worked for current-range live events, but it could allow investor sample data to appear when a workspace had real historical tracker evidence but no events in the selected analytics range. This is now hardened: any live workspace event evidence from install health prevents sample/demo analytics from being selected.

Build and focused analytics import checks passed.

## Systems Touched

- Dashboard data-source selection.
- Activity feed data-source selection.
- Analytics data-source selection.
- Analytics view-model helpers.
- Visibility preview labeling.
- Monetization/licensing preview labeling.
- Existing mock/sample data boundaries.

## Files Touched

Modified:

- `src/analytics/analyticsApi.js`
- `src/context/AppContext.jsx`
- `src/api/mockApi.js`
- `src/pages/Visibility.jsx`
- `src/pages/Monetization.jsx`

Added:

- `KTRLAI_PHASE5_ANALYTICS_HARDENING_REPORT.md`

Related files audited but not changed:

- `api/_analyticsSummaryRoute.js`
- `api/_analyticsRollups.js`
- `src/pages/Dashboard.jsx`
- `src/pages/Activity.jsx`
- `src/pages/Analytics.jsx`
- `src/components/SetupGuide.jsx`

## Analytics/Data Sources Audited

### Live Sources

- `/api/analytics?action=summary`
- Supabase `activity_logs`
- Analytics rollup tables:
  - `analytics_daily_rollups`
  - `analytics_bot_rollups`
  - `analytics_page_rollups`
  - `analytics_status_rollups`
- Install health view through `/api/analytics?action=summary&view=install_health`

### Frontend View Models

- `toDashboardView(summary)`
- `toAnalyticsView(summary)`
- `toActivityRows(summary)`
- `createActivityMeta(summary)`
- `createEmptyDashboard()`
- `createEmptyAnalytics()`
- `createEmptyActivityMeta()`
- `decorateSampleDashboard(data)`
- `decorateSampleAnalytics(data)`
- `createSampleActivityMeta()`

### Mock/Preview Sources

- `mockApi.getDashboard()`
- `mockApi.getAnalytics()`
- `mockApi.getActivityLogs()`
- `mockApi.checkVisibility()`
- `mockApi.getMonetization()`

## Remaining Mock/Demo Logic Discovered

These remain intentionally present:

1. Investor sample analytics
   - Controlled by `VITE_SHOW_INVESTOR_SAMPLE_DATA`.
   - Only used when no live workspace event evidence exists.
   - Labeled as `Sample preview`.

2. Local development fallback
   - Controlled by `allowLocalMockFallback`.
   - Only active outside production builds.
   - Keeps the UI usable without live backend env vars.

3. Visibility scans
   - Still preview-backed through `mockApi.checkVisibility()`.
   - Now labeled as `Visibility preview`.
   - Not mixed with live tracker analytics.

4. Monetization/licensing revenue modeling
   - Still preview-backed through `mockApi.getMonetization()`.
   - Now labeled as `Licensing readiness preview`.
   - Payout execution remains controlled by backend safety flags.

5. Training page
   - Still mock/local preview behavior.
   - Not part of analytics live-data hardening.

## Real-Data Prioritization Strategy

Phase 5 introduced a stricter evidence check:

```js
summaryHasWorkspaceEvidence(summary)
```

This returns true when:

- `summary.hasRealData` is true,
- or install health reports `lastEventAt`,
- or install health reports `sdkInstalled`,
- or install health reports `eventsToday > 0`.

Dashboard, Activity, and Analytics now use live view models when this evidence exists, even if the selected analytics range has zero events.

Result:

- Real current-range data shows live metrics.
- Real historical tracker evidence shows live/empty range state, not investor sample metrics.
- Only true zero-event workspaces can show empty states or investor sample previews.

## Fallback Strategy

### Production

- Analytics API errors are surfaced as errors.
- No local mock fallback is used in production.
- Sample previews are only selected from successful live summaries with no workspace event evidence and `VITE_SHOW_INVESTOR_SAMPLE_DATA` enabled.

### Local Development

- If live analytics fail and local fallback is allowed, dashboard/activity/analytics may use empty or sample data depending on `VITE_SHOW_INVESTOR_SAMPLE_DATA`.
- This preserves developer ergonomics without changing production behavior.

### Rollup Lag

The backend analytics endpoint already follows this strategy:

1. Try rollups when available and current enough.
2. Use recent raw `activity_logs` for live activity feed.
3. Fall back to raw aggregation when rollups are missing, empty while fresh raw rows exist, or do not cover the latest event.

No analytics API contract changes were required.

## Workspace Isolation Validation

Validated by code-path audit:

- `/api/analytics?action=summary` requires a Supabase bearer token.
- `requireWorkspaceRole()` verifies membership for the requested `workspace_id`.
- Analytics queries filter by `workspace_id`.
- Rollup fetches use `workspaceId`.
- Raw `activity_logs` fallback uses `workspace_id` filters.
- Frontend requests use `authService.getActiveWorkspaceId()`.
- AppContext clears dashboard/activity/analytics/settings on workspace change.

Remaining manual validation:

- Use two staging workspaces with separate events.
- Confirm each dashboard/activity/analytics view only shows its own workspace data.

## Fixes Applied

### 1. Hardened live evidence detection

Added `summaryHasWorkspaceEvidence(summary)` to `src/analytics/analyticsApi.js`.

This prevents sample metrics from appearing when the workspace has received any live event evidence, even if the current range is empty.

### 2. Updated Dashboard/Activity/Analytics source selection

Updated `src/context/AppContext.jsx` so these loaders use live view models when `summaryHasWorkspaceEvidence(summary)` is true:

- `getDashboardAnalyticsData()`
- `getAnalyticsData()`
- `getActivityData()`

### 3. Improved live-but-empty range messaging

When a workspace has event evidence but no events in the selected range, the view model now returns:

- `source: "live"`
- `sourceLabel: "Live data"`
- explanatory copy that no events were found in the selected range.

### 4. Labeled preview-only visibility data

`mockApi.checkVisibility()` now returns preview metadata:

- `source: "preview"`
- `sourceLabel: "Visibility preview"`
- `sourceDetail: "Visibility scans are planning guidance until live provider verification is enabled."`

The Visibility page renders that source notice above preview results.

### 5. Labeled preview-only monetization data

`mockApi.getMonetization()` data now includes preview metadata:

- `source: "preview"`
- `sourceLabel: "Licensing readiness preview"`
- `sourceDetail: "Commercial modeling is shown as planning data until live licensing ledger workflows are enabled."`

The Monetization page renders that source notice above licensing preview metrics.

## Compatibility Guarantees

- No route paths changed.
- No analytics API response keys were removed.
- No tracker SDK methods changed.
- No tracker payload fields changed.
- No `activity_logs` event schema fields changed.
- No dashboard, activity, or analytics route contract changed.
- No backend query contract changed.
- Investor sample data still works when explicitly enabled and no real workspace event evidence exists.
- Local development fallback still works outside production.

## Risks Avoided

- Avoided changing `/api/track`.
- Avoided changing `activity_logs` schema.
- Avoided changing analytics rollup schema.
- Avoided replacing the analytics endpoint.
- Avoided loading raw logs client-side.
- Avoided making Visibility or Monetization pretend to be live production data.
- Avoided broad AppContext refactors.

## Validation Results

### Build

Command:

```bash
npm run build
```

Result: passed.

Observed:

- Vite build completed successfully.
- 108 modules transformed.
- No build errors.

### Import/Syntax Smoke

Command:

```bash
node -e "Promise.all([import('./api/analytics.js'), import('./api/_analyticsSummaryRoute.js'), import('./api/_analyticsRollups.js'), import('./src/analytics/analyticsApi.js')])..."
```

Result: passed.

Validated imports:

- `api/analytics.js`
- `api/_analyticsSummaryRoute.js`
- `api/_analyticsRollups.js`
- `src/analytics/analyticsApi.js`

### Transform-Level Source Selection Smoke

Validated cases:

| Case | Evidence detected | Source selected |
| --- | --- | --- |
| Zero events | No | `empty` |
| Historical live event outside range | Yes | `live` |
| Low-volume live data | Yes | `live` |

This confirms sample data is no longer eligible when live event evidence exists outside the selected range.

## Required Live Staging Validation

Still recommended in staging:

1. Zero events
   - New workspace with no tracker events.
   - Confirm Dashboard/Analytics/Activity show empty or sample preview only if sample mode is enabled.

2. Low-volume events
   - Send one valid tracker event.
   - Confirm Dashboard/Activity/Analytics switch to live data.

3. Historical live event outside current range
   - Use a workspace with older events outside the selected window.
   - Confirm sample metrics do not appear.

4. Rollup lag
   - Send a fresh event before rollup processing.
   - Confirm Activity shows the recent raw event.
   - Confirm Dashboard/Analytics use raw fallback or safe live state.

5. Multiple workspaces
   - Send events to workspace A.
   - Confirm workspace B does not display A's events.

6. Policy metadata
   - Send an event matching a saved governance policy.
   - Confirm Activity/metadata remain consistent with Phase 4.

## Remaining Gaps Before V1 Stabilization Completion

1. Visibility scans are still preview-backed.
   - They are now labeled, but not yet a live provider-backed system.

2. Monetization/licensing revenue is still preview-backed.
   - It is now labeled, but real licensing ledger workflows remain outside this phase.

3. Full staging multi-workspace analytics isolation needs manual verification.

4. Rollup freshness should be validated with real staging events after the rollup job runs and before it runs.

5. No automated browser smoke suite exists yet for analytics live/sample switching.

## Safe To Continue?

Yes.

Phase 5 hardening is safe to continue into live staging validation. Real tracker evidence now takes precedence over sample/demo analytics, preview-only surfaces are labeled, build passed, and analytics imports passed.
