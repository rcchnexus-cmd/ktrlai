# KtrlAI Staging Migration Execution Report

Date: 2026-05-18

Phase: V1 Phase 1 — Live Staging Migration Validation

## Execution Verdict

Live staging migration execution was not completed from this workspace.

The migration chain could not be executed because the current environment does not have:

- a Supabase staging PostgreSQL connection string,
- a Supabase service/staging URL usable for SQL execution,
- `psql`,
- the Supabase CLI.

No SQL was run against a live staging database from this workspace. No production application code was modified.

This report is therefore an execution-readiness failure report, not a successful live migration report.

## Environment Check

Checked environment variables:

| Variable | Present |
| --- | --- |
| `SUPABASE_DB_URL` | No |
| `DATABASE_URL` | No |
| `SUPABASE_URL` | No |
| `SUPABASE_SERVICE_ROLE_KEY` | No |
| `PGHOST` | No |
| `PGUSER` | No |
| `PGDATABASE` | No |
| `PGPASSWORD` | No |

Checked local SQL tools:

| Tool | Available |
| --- | --- |
| `psql` | No |
| `supabase` CLI | No |

## Exact Execution Order

The documented migration execution order remains:

1. `src/backend/schema.sql`
2. `src/backend/billing_migration.sql`
3. `src/backend/domain_api_key_comments.sql`
4. `src/backend/track_ingestion_migration.sql`
5. `src/backend/api_key_hashing_migration.sql`
6. `src/backend/domain_verification_migration.sql`
7. `src/backend/pre_production_hardening.sql`
8. `src/backend/admin_dashboard_migration.sql`
9. `src/backend/stripe_webhook_idempotency.sql`
10. `src/backend/analytics_engine_migration.sql`
11. `src/backend/bot_detection_migration.sql`
12. `src/backend/analytics_rollups_migration.sql`
13. `src/backend/enterprise_security_migration.sql`
14. `src/backend/scale_optimization_migration.sql`
15. `src/backend/jobs_migration.sql`
16. `src/backend/notifications_migration.sql`

## Pass/Fail Result Per Migration

Because no live SQL execution was possible, every migration is marked `not executed`.

| Order | Migration | Result |
| --- | --- | --- |
| 1 | `schema.sql` | Not executed |
| 2 | `billing_migration.sql` | Not executed |
| 3 | `domain_api_key_comments.sql` | Not executed |
| 4 | `track_ingestion_migration.sql` | Not executed |
| 5 | `api_key_hashing_migration.sql` | Not executed |
| 6 | `domain_verification_migration.sql` | Not executed |
| 7 | `pre_production_hardening.sql` | Not executed |
| 8 | `admin_dashboard_migration.sql` | Not executed |
| 9 | `stripe_webhook_idempotency.sql` | Not executed |
| 10 | `analytics_engine_migration.sql` | Not executed |
| 11 | `bot_detection_migration.sql` | Not executed |
| 12 | `analytics_rollups_migration.sql` | Not executed |
| 13 | `enterprise_security_migration.sql` | Not executed |
| 14 | `scale_optimization_migration.sql` | Not executed |
| 15 | `jobs_migration.sql` | Not executed |
| 16 | `notifications_migration.sql` | Not executed |

## Exact SQL Errors

No database SQL errors were captured because no database execution occurred.

Execution blocker:

```text
Cannot run live staging migration validation:
- no staging PostgreSQL connection string is available
- no local psql executable is available
- no Supabase CLI executable is available
```

## Fixes Required

No migration fixes can be confirmed until the SQL chain is executed against a real clean staging database.

Required operational fixes before rerun:

1. Provide a clean Supabase staging PostgreSQL connection string.
2. Provide a SQL runner, preferably `psql` or the Supabase CLI.
3. Run the documented migration chain in order.
4. Capture stdout/stderr or Supabase SQL editor output per migration.

No schema rewrites are recommended at this stage.

## RLS Validation Findings

RLS was not live-validated.

Required RLS validation after migrations execute:

- Owner can read and mutate expected workspace resources.
- Admin can manage operational workspace resources where intended.
- Analyst has analytics/activity visibility without billing/security mutation rights.
- Viewer remains read-only.
- Existing `member` role remains compatible.
- Normal users cannot read or mutate other workspaces.
- Service-role-only tables are not directly user-accessible.

Service-role-only table validation should include:

- `stripe_webhook_events`
- `jobs`
- `rate_limit_events`
- `abuse_counters`
- service-written notification/audit operational records where applicable

## Enum Validation Findings

Enums were not live-validated.

Expected enum validation after execution:

- `workspace_role` includes `owner`, `admin`, `member`, `viewer`, `analyst`.
- `domain_status` includes `pending`, `verified`, `failed`, `disabled`.
- `activity_status` includes `allowed`, `blocked`, `restricted`, `paid_access`, `summaries_only`.
- `visibility_provider` includes `chatgpt`, `perplexity`, `claude`, `google_ai`, `other`.
- `access_decision` includes `allow_full`, `allow_summary`, `paid_access_required`, `training_denied`, `block_all`.
- `privacy_level` includes `public`, `restricted`, `private`.
- `job_status` includes `queued`, `processing`, `completed`, `failed`.

## Index Validation Findings

Indexes were not live-validated.

Expected index groups after execution:

- activity log workspace/time indexes,
- activity log bot/status/page/category/AI/suspicious indexes,
- domain workspace/hostname/status indexes,
- API key active prefix and revocation indexes,
- workspace usage month indexes,
- payout and earnings indexes,
- webhook event indexes,
- analytics rollup indexes,
- invitation/team indexes,
- policy indexes,
- rate-limit/abuse indexes,
- job queue indexes,
- notification event indexes.

## Trigger Validation Findings

Triggers were not live-validated.

Expected trigger validation after execution:

- Base `set_updated_at()` function exists.
- Update triggers exist for base mutable tables.
- `jobs_set_updated_at` trigger exists after `jobs_migration.sql`.
- No duplicate trigger errors occur during clean execution.

## Analytics View Validation

Analytics views were not live-validated.

Expected analytics view checks after execution:

- `workspace_event_counts_daily` compiles.
- `workspace_bot_distribution` compiles.
- `workspace_top_pages` compiles.
- Views can be queried by authorized workspace users.
- Views do not leak cross-workspace data under RLS.
- Rollup tables can be queried by authorized workspace users.
- `analytics_rollup_runs` is visible to workspace admins and platform admins as intended.

## Service-Role Operational Table Validation

Service-role operational tables were not live-validated.

Expected operational tables after execution:

- `stripe_webhook_events`
- `jobs`
- `rate_limit_events`
- `abuse_counters`
- `notification_events`
- `audit_events`
- `audit_logs`

Required validation:

- service role can insert/update where server routes require it,
- regular users cannot directly mutate service-only operational tables,
- admin APIs can return sanitized operational summaries.

## Final Schema Readiness Verdict

Final schema readiness is not verified.

Current status:

- Static readiness was previously assessed as likely coherent.
- Live staging execution has not occurred.
- No pass/fail SQL execution results are available.
- No final information schema, enum, index, trigger, policy, or view query results are available.

## Can V1 Phase 2 Smoke Testing Officially Begin?

No.

V1 Phase 2 smoke testing should not officially begin until the migration chain is executed against a clean Supabase staging project and the final schema is validated.

Safe work that can happen meanwhile:

- Prepare the Phase 2 smoke checklist.
- Prepare API import/syntax checks.
- Prepare manual route test scripts.
- Prepare test users and test workspace plan.

Blocked work:

- production-like auth/workspace smoke tests,
- tracker ingestion smoke tests,
- settings API key/domain smoke tests,
- billing webhook smoke tests,
- RLS role behavior tests.

## Required Inputs to Complete Live Validation

Provide one of the following:

### Option A: Direct PostgreSQL execution

- `SUPABASE_DB_URL` or `DATABASE_URL` for a clean staging database.
- A local SQL runner such as `psql`.

### Option B: Supabase CLI execution

- Supabase CLI installed and authenticated.
- Project linked to the clean staging Supabase project.

### Option C: Manual Supabase SQL Editor execution

Run each migration manually in Supabase SQL editor and provide:

- success/failure per migration,
- exact SQL error output if any,
- final schema validation query output.

## Compatibility Notes to Preserve During Fixes

If migration fixes are required after real execution:

- isolate fixes to the failing migration only,
- preserve existing table and column names,
- preserve enum values already used by application code,
- preserve RLS helper function contracts,
- preserve API route assumptions,
- avoid broad schema rewrites,
- avoid destructive migration steps,
- document compatibility impact for existing databases.

