# KtrlAI Phase 3 Tracker Validation Plan

Date: 2026-05-18

Goal: validate tracker ingestion end-to-end in live staging without changing product architecture, API contracts, UI design, or tracker compatibility.

## Objective

Prove that the production tracker path works from a hosted page through `/api/track`, Supabase `activity_logs`, dashboard/activity visibility, analytics updates, and policy metadata enrichment.

Phase 3 should produce operational confidence that a real customer website can install the KtrlAI tracker, send events with a valid workspace API key, and see those events reflected in the app.

## Systems Involved

- Hosted staging test page.
- `public/tracker.js`.
- `/api/track`.
- Supabase `api_keys`.
- Supabase `domains`.
- Supabase `activity_logs`.
- Bot detection and policy metadata enrichment.
- Dashboard, Activity, and Analytics frontend views.
- Workspace API key generation and rotation flow.
- Staging environment variables.

## Hosted Test Page Setup

Objective: validate tracker behavior from a realistic browser context rather than `file://`.

Setup steps:

1. Create a minimal hosted HTML page on a staging/test domain.
2. Install the KtrlAI tracker snippet copied from the staging Settings install flow.
3. Use the live staging workspace ID.
4. Use a freshly generated live staging API key.
5. Confirm the page is served over `https://`.
6. Confirm browser devtools show `public/tracker.js` loading successfully.
7. Confirm the page sends exactly one initial page event on load.

Recommended test page body:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>KtrlAI Tracker Staging Test</title>
    <script
      async
      src="https://ktrlai.vercel.app/tracker.js"
      data-workspace-id="REPLACE_WITH_WORKSPACE_ID"
      data-api-key="REPLACE_WITH_KTRL_LIVE_KEY"
    ></script>
  </head>
  <body>
    <h1>KtrlAI Tracker Staging Test</h1>
    <p>This page validates live tracker ingestion.</p>
  </body>
</html>
```

Acceptance criteria:

- Test page loads without console crashes.
- Tracker script loads once.
- Initial page event is sent once.
- No duplicate event spam occurs on reload.

## Tracker Script Install Validation

Objective: confirm the Settings-generated snippet is accurate and usable.

Validation steps:

1. Open Settings in staging.
2. Generate or rotate an API key if needed.
3. Copy the HTML tracker snippet.
4. Confirm the snippet contains:
   - correct `src`,
   - correct `data-workspace-id`,
   - correct `data-api-key`,
   - no placeholder key when a new plaintext key is available.
5. Paste the snippet into the hosted test page.
6. Reload the page and inspect network requests.

Acceptance criteria:

- Copied snippet uses the expected staging production endpoint.
- Snippet does not contain `ktrl_live_your_key` when a new plaintext key was just generated.
- Snippet works from a hosted page.
- If testing locally, docs instruct using a local server instead of relying on `file://`.

## Valid API Key Event Test

Objective: validate successful ingestion with a valid, non-revoked key.

Test event:

```js
fetch("https://ktrlai.vercel.app/api/track", {
  method: "POST",
  headers: {
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    workspaceId: "REPLACE_WITH_WORKSPACE_ID",
    apiKey: "REPLACE_WITH_KTRL_LIVE_KEY",
    url: "https://example.com/ktrlai-staging-test",
    referrer: "https://example.com",
    userAgent: "Mozilla/5.0 GPTBot/1.0",
    pageTitle: "KtrlAI Tracker Staging Test",
    timestamp: new Date().toISOString()
  })
});
```

Expected result:

- HTTP `200` or accepted success response.
- Response includes `ok: true`.
- Response identifies live mode where returned.
- No secret values are returned.

Acceptance criteria:

- Valid key is accepted.
- Event is inserted into `activity_logs`.
- API key `last_used_at` updates.
- Bot detection metadata is present or derivable from inserted metadata.

## Invalid API Key Rejection Test

Objective: confirm invalid keys are rejected without weakening validation.

Test event:

```js
fetch("https://ktrlai.vercel.app/api/track", {
  method: "POST",
  headers: {
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    workspaceId: "REPLACE_WITH_WORKSPACE_ID",
    apiKey: "ktrl_live_invalidinvalidinvalid",
    url: "https://example.com/ktrlai-invalid-key",
    referrer: "",
    userAgent: "Mozilla/5.0 GPTBot/1.0",
    pageTitle: "Invalid Key Test",
    timestamp: new Date().toISOString()
  })
});
```

Expected result:

- HTTP `401`.
- Safe JSON error.
- No activity log inserted.
- No full key or hash disclosed.

Acceptance criteria:

- Invalid key does not write to `activity_logs`.
- Error message is clear but not sensitive.

## Revoked Key Rejection Test

Objective: confirm rotated/revoked keys stop working.

Validation steps:

1. Generate an API key.
2. Send a successful test event.
3. Rotate the API key in Settings.
4. Reuse the old key against `/api/track`.
5. Send a second event with the new key.

Expected result:

- Old key returns `401`.
- Old key does not insert an event.
- New key succeeds.
- Only the new key updates `last_used_at`.

Acceptance criteria:

- Revoked key is rejected.
- Rotated key remains usable.
- No plaintext key is recoverable after refresh.

## Activity Logs Insert Validation

Objective: confirm successful events create the expected database row.

Validate in Supabase:

- `workspace_id`
- `domain_id` if matched, otherwise `null`
- `bot_name`
- `bot_type`
- `category`
- `confidence_score`
- `is_ai_bot`
- `is_suspicious`
- `page_path`
- `url`
- `referrer`
- `user_agent`
- `page_title`
- `status`
- `occurred_at`
- `metadata`

Acceptance criteria:

- Row exists in `activity_logs`.
- Row belongs only to the tested workspace.
- URL/path/title/user agent are stored correctly.
- Bot detection enrichment is present.
- No API key plaintext or hash is stored in activity metadata.

## Dashboard and Activity Visibility Validation

Objective: confirm live events become visible in the app.

Validation steps:

1. Send a valid event.
2. Open `/dashboard`.
3. Confirm Operations view uses live data or reflects live recent activity.
4. Open `/activity`.
5. Confirm the event appears in the Live Stream.
6. Confirm filters do not hide the event unexpectedly.

Acceptance criteria:

- Dashboard loads without blank screen.
- Activity page shows the new event or updates after polling/refresh.
- Event displays bot/operator, path, status, category, and timestamp.
- UI does not label live data as sample preview when real data exists.

## Analytics Update Validation

Objective: confirm live activity updates analytics summaries.

Validation steps:

1. Send one or more valid test events.
2. Open `/analytics`.
3. Confirm traffic totals increase.
4. Confirm bot distribution includes the tested bot where expected.
5. Confirm top pages include the tested path where expected.
6. Confirm recent activity remains live-log based even if rollups lag.

Acceptance criteria:

- Analytics does not crash if rollups have not processed yet.
- Raw fallback or recent activity still reflects test event.
- `hasRealData` behavior favors live data when events exist.
- No cross-workspace activity appears.

## Policy Metadata Validation

Objective: confirm tracker ingestion attaches governance/policy context without hard blocking.

Validation steps:

1. Configure or confirm a workspace policy for a known bot scope where available.
2. Send a test event with a matching user agent.
3. Inspect inserted `activity_logs.metadata`.
4. Confirm policy decision metadata is present where applicable.
5. Confirm enforcement remains visibility-only unless explicitly implemented elsewhere.

Acceptance criteria:

- Policy metadata is stored safely.
- Missing policies do not crash ingestion.
- Policy decision does not accidentally block valid ingestion.
- Event remains visible in Activity and Analytics.

## Negative and Safety Tests

Run these after the main valid flow passes:

1. Missing `workspaceId`.
2. Missing `apiKey`.
3. Invalid URL.
4. Oversized metadata payload.
5. Unsupported method.
6. OPTIONS preflight.
7. Rapid repeated events to observe rate-limit behavior.

Acceptance criteria:

- Bad requests return safe JSON errors.
- Missing/invalid API keys return `401`.
- Oversized or malformed payloads are rejected safely.
- OPTIONS returns expected CORS response.
- Rate limiting returns graceful `429` when triggered.
- Normal tracker usage is not blocked.

## Acceptance Criteria

Phase 3 passes when:

- Hosted test page loads tracker successfully.
- Valid API key event is accepted.
- Invalid API key is rejected.
- Revoked key is rejected after rotation.
- Successful event inserts into `activity_logs`.
- `api_keys.last_used_at` updates after successful ingestion.
- Dashboard and Activity show live event evidence.
- Analytics reflects live data or safe raw fallback.
- Policy metadata is stored where applicable.
- No secrets are exposed in responses, frontend, logs, or metadata.
- No app route crashes or blank screens occur.
- No cross-workspace data leakage is observed.

## Definition of Done

Phase 3 is done when:

1. A hosted staging page sends at least one valid event through `public/tracker.js`.
2. Manual fetch tests confirm valid, invalid, and revoked key behavior.
3. Supabase confirms correct `activity_logs` insertion.
4. Dashboard, Activity, and Analytics confirm live event visibility.
5. Policy metadata is verified or documented as safely absent when no policy applies.
6. All failures return safe JSON errors.
7. A final Phase 3 validation report is created with evidence, screenshots or row IDs where appropriate, and a clear pass/fail verdict.

## What Not To Touch

- Do not change API contracts.
- Do not change tracker public method names or data attributes.
- Do not weaken API key hashing or validation.
- Do not redesign UI.
- Do not refactor backend architecture.
- Do not change Supabase auth/session logic.
- Do not change billing, jobs, notifications, Redis, rollups, or admin authorization.

## Next Step

Create and host the staging tracker test page, then run the valid API key event test and confirm the inserted `activity_logs` row.
