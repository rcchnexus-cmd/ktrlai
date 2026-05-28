# KtrlAI Migration Readiness Report

Date: 2026-05-18

Phase: V1 Phase 1 — Migration & Environment Readiness

## Validation Status

This report validates the migration chain from the repository files and checks whether a clean Supabase staging execution can be performed from the current workspace.

Important result:

- A clean Supabase staging execution was not performed from this environment.
- No `SUPABASE_DB_URL`, `DATABASE_URL`, `SUPABASE_URL`, or `SUPABASE_SERVICE_ROLE_KEY` environment variable is present in the shell.
- No local `psql` client is available in the shell.
- Therefore, no live SQL execution errors were captured.

Static migration dependency review did complete. The static review found no obvious migration order conflict for a clean Supabase project, but Phase 2 production smoke testing should not be considered fully unblocked until the SQL chain is actually executed against staging.

## Migration Execution Order

Documented order from `src/backend/README.md`:

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
12. `analytics_rollups_migration.sql`
13. `enterprise_security_migration.sql`
14. `scale_optimization_migration.sql`
15. `jobs_migration.sql`
16. `notifications_migration.sql`

## Passed Migrations

No migration can be marked execution-passed because the chain was not run against a live clean Supabase staging database from this workspace.

Static dependency review status:

| Order | Migration | Static status | Notes |
| --- | --- | --- | --- |
| 1 | `schema.sql` | Pass for clean database | Creates base enums, tables, indexes, triggers, functions, and RLS policies. Not idempotent on existing databases. |
| 2 | `billing_migration.sql` | Pass | Depends on `profiles` and `workspaces`; additive Stripe fields and indexes. |
| 3 | `domain_api_key_comments.sql` | Pass | Comments only; depends on `domains` and `api_keys`. |
| 4 | `track_ingestion_migration.sql` | Pass | Adds `url`, `referrer`, and `page_title` before analytics views use them. |
| 5 | `api_key_hashing_migration.sql` | Pass with compatibility caution | Reinforces `api_keys` hash/prefix lookup. Existing legacy null rows require backfill or revocation. |
| 6 | `domain_verification_migration.sql` | Pass | Adds `last_checked_at`; `failed` enum value is already in base schema but `if not exists` makes it safe on modern Supabase Postgres. |
| 7 | `pre_production_hardening.sql` | Pass | Adds usage, earnings, payouts, and audit events. Depends on base workspace/profile/activity tables and role helper functions. |
| 8 | `admin_dashboard_migration.sql` | Pass | Adds `platform_admins` before rollup policies reference platform admin visibility. |
| 9 | `stripe_webhook_idempotency.sql` | Pass | Adds webhook replay table. RLS is enabled with no user policies, which is intentional for service-role access. |
| 10 | `analytics_engine_migration.sql` | Pass | Depends on activity log fields added by earlier migrations. Security-invoker views require supported Postgres version. |
| 11 | `bot_detection_migration.sql` | Pass | Adds bot detection columns and indexes to `activity_logs`. |
| 12 | `analytics_rollups_migration.sql` | Pass | Depends on workspaces, bot detection fields, and `platform_admins` from admin migration. |
| 13 | `enterprise_security_migration.sql` | Pass with enum compatibility caution | Adds `analyst` role if missing and keeps existing `member` rows compatible. |
| 14 | `scale_optimization_migration.sql` | Pass | Depends on prior usage, webhook, audit, rate-limit, and policy tables. |
| 15 | `jobs_migration.sql` | Pass | Depends on base `set_updated_at()` trigger function. Service-role-only RLS behavior is intentional. |
| 16 | `notifications_migration.sql` | Pass | Depends on workspaces and role helper functions. Adds notification prefs and event log. |

## Failed Migrations

No live migration failures were captured because the migrations were not executed against a staging database in this environment.

Static review did not identify an obvious clean-database order failure.

## Exact SQL Errors

No exact SQL errors are available from a live execution.

Execution blocker:

```text
No Supabase database connection string was available.
No local psql client was available.
```

Required to capture exact SQL errors:

- A clean Supabase staging project.
- A direct database URL such as `SUPABASE_DB_URL` or `DATABASE_URL`, or manual execution through the Supabase SQL editor.
- A SQL execution log for each migration in documented order.

## Dependency Issues

Static dependency review found the documented order is generally coherent:

- Base schema creates `workspace_role`, `domain_status`, `activity_status`, workspace tables, activity logs, helper functions, triggers, and RLS policies before later migrations depend on them.
- `track_ingestion_migration.sql` runs before analytics views use `url`, `referrer`, or `page_title`.
- `admin_dashboard_migration.sql` runs before analytics rollup policies reference `platform_admins`.
- `bot_detection_migration.sql` runs before analytics rollup tables use AI/suspicious bot concepts.
- `enterprise_security_migration.sql` runs before `scale_optimization_migration.sql` adds indexes on `audit_logs`, `rate_limit_events`, and `ai_policies`.
- `jobs_migration.sql` runs after base `set_updated_at()` exists.
- `notifications_migration.sql` runs after role helpers exist.

Dependency cautions:

1. `schema.sql` is clean-database oriented.
   - It uses plain `create type`, `create table`, `create index`, `create trigger`, and `create policy`.
   - It should not be rerun as-is on an existing database.

2. `enterprise_security_migration.sql` modifies `public.workspace_role`.
   - It safely checks for `owner`, `admin`, `member`, `analyst`, and `viewer`.
   - Existing databases that already had `analyst` manually added should be compatible.
   - Existing `member` rows remain valid.

3. `api_key_hashing_migration.sql` can skip NOT NULL reinforcement if legacy null key rows exist.
   - This is safe, but it means existing databases may require cleanup before key hash enforcement is fully true.

4. `analytics_engine_migration.sql` uses `security_invoker = true` views.
   - This is expected to work on modern Supabase Postgres.
   - It should be verified in the actual staging project version.

5. Two audit tables exist after the full chain.
   - `audit_events` is created by pre-production hardening.
   - `audit_logs` is created by enterprise security.
   - This is not an execution conflict, but operational ownership should be kept clear.

## Enum, Index, and Policy Conflicts

### Enums

Expected enum state after full chain:

- `workspace_role`: `owner`, `admin`, `member`, `viewer`, `analyst`
- `domain_status`: `pending`, `verified`, `failed`, `disabled`
- `activity_status`: `allowed`, `blocked`, `restricted`, `paid_access`, `summaries_only`
- `visibility_provider`: `chatgpt`, `perplexity`, `claude`, `google_ai`, `other`
- `access_decision`: `allow_full`, `allow_summary`, `paid_access_required`, `training_denied`, `block_all`
- `privacy_level`: `public`, `restricted`, `private`
- `job_status`: `queued`, `processing`, `completed`, `failed`

Static conflict result:

- No enum conflict found for a clean database.
- Existing database caution: do not rerun `schema.sql`; it recreates existing enum types without `if not exists`.

### Indexes

The chain creates indexes for:

- Activity log workspace/time lookups.
- Activity log status, bot, page, URL, category, AI, suspicious, and confidence queries.
- Domain workspace/status/hostname lookups.
- API key active prefix lookup and revocation lookup.
- Workspace usage month lookup.
- Earnings ledger and payout review.
- Audit events and audit logs.
- Platform admins.
- Stripe webhook event lookup and idempotency.
- Analytics rollup tables.
- Workspace invitations.
- AI policies.
- Rate-limit events and abuse counters.
- Jobs.
- Notification events.

Static conflict result:

- Later migrations generally use `create index if not exists`.
- Base schema indexes do not use `if not exists`; this is fine on a clean database but unsafe to rerun on existing databases.

### Policies

The chain enables RLS on the expected workspace-owned and operational tables.

Expected RLS groups:

- Base workspace tables are member/admin scoped.
- Earnings, payout requests, and usage months have member/admin-visible policies where appropriate.
- Platform admins have admin allow-list visibility.
- Stripe webhook events are service-role-only by absence of user policies.
- Analytics rollups are member-visible, with rollup runs admin/platform-admin visible.
- Invitations, audit logs, and AI policies are owner/admin scoped.
- Rate-limit events and abuse counters are service-role-only.
- Jobs are service-role-only.
- Notification events are owner/admin visible and service-role writable.

Static conflict result:

- No obvious policy order conflict found.
- Base schema policies are not idempotent and should not be rerun on an existing database.
- Live RLS behavior still needs role-based testing with owner, admin, analyst, viewer, and member users.

## Missing Tables or Columns

Static review expects the following tables after full migration chain:

Core workspace/auth support:

- `profiles`
- `workspaces`
- `workspace_members`

Workspace setup and ingestion:

- `domains`
- `api_keys`
- `activity_logs`
- `visibility_checks`
- `control_rules`

Billing and monetization:

- `monetization_settings`
- `workspace_usage_months`
- `earnings_ledger`
- `payout_requests`
- `stripe_webhook_events`

Training:

- `training_permissions`

Admin and audit:

- `platform_admins`
- `audit_events`
- `audit_logs`

Analytics:

- `workspace_event_counts_daily` view
- `workspace_bot_distribution` view
- `workspace_top_pages` view
- `analytics_daily_rollups`
- `analytics_bot_rollups`
- `analytics_page_rollups`
- `analytics_status_rollups`
- `analytics_rollup_runs`

Enterprise/governance/security:

- `workspace_invitations`
- `ai_policies`
- `rate_limit_events`
- `abuse_counters`

Jobs and notifications:

- `jobs`
- `notification_events`

No missing table or column was identified through static dependency review, but this must be confirmed by querying `information_schema` after live staging execution.

## RLS Readiness

Static RLS readiness result:

- RLS is enabled on all core workspace-owned tables in the base schema.
- Later workspace-owned tables also enable RLS.
- Service-role-only operational tables intentionally avoid public insert/update policies.
- Owner/admin role checks are consistently used for sensitive workspace mutations.

Live RLS validation still required:

- Owner can manage workspace setup and policies.
- Admin can manage operational settings where intended.
- Analyst can view analytics/activity where intended.
- Viewer is read-only where intended.
- Existing `member` behaves safely.
- Normal users cannot read other workspaces.
- Service-role routes can write server-only operational tables.

## Schema Support for V1 Systems

Static support assessment:

| V1 system | Static schema support |
| --- | --- |
| Auth/workspaces | Supported by `profiles`, `workspaces`, `workspace_members`, role enum, RLS helpers. |
| API keys | Supported by `api_keys`, key prefix/hash columns, revocation, indexes, comments. |
| Domains | Supported by `domains`, verification token, status, verified/last checked timestamps. |
| Activity logs | Supported by `activity_logs`, tracker URL fields, bot detection columns, indexes. |
| Analytics rollups | Supported by rollup tables, rollup runs table, indexes, RLS policies. |
| Governance policies | Supported by `ai_policies` plus base `control_rules`. |
| Notifications | Supported by workspace notification preferences and `notification_events`. |
| Jobs | Supported by `jobs` table and `job_status` enum. |
| Billing/subscriptions | Supported by workspace Stripe columns and `stripe_webhook_events`. |
| Admin visibility | Supported by `platform_admins`, platform admin function, audit/rate/job/notification/rollup tables. |

## Compatibility Concerns for Existing Databases

1. Do not rerun `schema.sql` on an existing database.
   - It is intended for clean project initialization.
   - It is not fully idempotent.

2. Existing `workspace_role` enum state must be checked before enterprise migration.
   - Required values after migration: `owner`, `admin`, `member`, `analyst`, `viewer`.
   - If `analyst` was manually added previously, the migration should skip adding it.

3. Legacy API key rows need review.
   - If any `api_keys.key_hash` or `api_keys.key_prefix` is null, NOT NULL reinforcement is skipped.
   - Those keys should be revoked or backfilled before V1.

4. Base trigger and policy names are not idempotent.
   - Rerunning base schema can fail on duplicate triggers or policies.

5. Audit table split should be operationally documented.
   - `audit_events` and `audit_logs` both exist.
   - This is not an execution blocker, but operators should know which table backs which UI/API surface.

6. Service-only tables require server route validation.
   - `stripe_webhook_events`, `jobs`, `rate_limit_events`, and `abuse_counters` rely on service-role writes.
   - This is expected but must be tested through server APIs.

## Whether Phase 2 Smoke Testing Can Safely Begin

Not fully yet.

Reason:

- The clean Supabase migration chain has not been executed from this environment.
- No live SQL execution logs or exact SQL errors are available.
- Phase 2 production smoke testing should wait until the migrations are actually run against staging and the resulting schema is inspected.

What can begin safely before live staging execution:

- Local build checks.
- Static API import/syntax checks.
- Frontend route smoke checklist preparation.
- Test plan preparation.

What should wait:

- Production-like auth/workspace smoke tests.
- Live tracker ingestion smoke tests.
- Settings API key/domain smoke tests.
- Billing webhook smoke tests.
- RLS role behavior tests.

## Required Next Action

Run the migration chain against a clean Supabase staging database in documented order.

Recommended execution method:

1. Create a clean Supabase staging project.
2. Open the Supabase SQL editor.
3. Run each SQL file in order.
4. After each file, record success or exact error.
5. After the final file, query `information_schema`, `pg_policies`, `pg_indexes`, and `pg_type` to confirm final schema state.

Minimum post-run verification queries:

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
order by table_name;
```

```sql
select typname, enumlabel
from pg_type t
join pg_enum e on e.enumtypid = t.oid
where t.typnamespace = 'public'::regnamespace
order by typname, e.enumsortorder;
```

```sql
select tablename, policyname, cmd
from pg_policies
where schemaname = 'public'
order by tablename, policyname;
```

```sql
select tablename, indexname
from pg_indexes
where schemaname = 'public'
order by tablename, indexname;
```

## Fixes Applied

No SQL or application code fixes were applied during this readiness report.

No production application code was modified.

## Readiness Verdict

Static migration readiness: likely coherent for a clean Supabase project.

Live migration readiness: not verified yet.

V1 Phase 2 smoke testing: should wait for actual staging execution logs.

