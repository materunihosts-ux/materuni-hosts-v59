# SEO Audit Snapshot Storage — Data Contract v1

Status: design contract only. Not an applied migration.

## Purpose

Persist reproducible on-page SEO audit observations so the admin can compare runs over time. This is not a Google Search Console, rank-tracking, backlink or traffic dataset.

## Data provenance

Every run must carry:
- `source = browser_live_crawl`
- `site_origin` (same-origin website base)
- `scope` (`sitemap` or `core`)
- `started_at`, `finished_at`
- `status` (`completed`, `partial`, `failed`)
- counts derived from stored page observations
- an idempotency key generated once per run and reused on retry

Do not store fetched HTML, cookies, credentials, access tokens, full request headers or visitor personal data.

## Proposed tables

### `public.seo_audit_runs`

| Column | Type | Rule |
|---|---|---|
| id | uuid | primary key, generated |
| created_by | uuid | not null, references auth.users(id) |
| idempotency_key | text | not null |
| source | text | not null, fixed to `browser_live_crawl` |
| site_origin | text | not null |
| scope | text | not null, `sitemap` or `core` |
| status | text | not null, `completed`, `partial`, `failed` |
| started_at | timestamptz | not null |
| finished_at | timestamptz | nullable |
| page_count | integer | not null, default 0 |
| issue_count | integer | not null, default 0 |
| created_at | timestamptz | not null, default now() |

Constraints: unique (`created_by`, `idempotency_key`); non-negative counts; validate allowed source/scope/status values. Index `created_at desc` and `created_by, created_at desc`.

### `public.seo_audit_pages`

| Column | Type | Rule |
|---|---|---|
| id | uuid | primary key, generated |
| run_id | uuid | not null, references seo_audit_runs(id) on delete cascade |
| path | text | not null |
| http_status | integer | nullable |
| title | text | not null, default empty |
| description | text | not null, default empty |
| h1_count | integer | not null, default 0 |
| canonical_url | text | not null, default empty |
| robots | text | not null, default empty |
| has_viewport | boolean | not null, default false |
| og_title | text | not null, default empty |
| images_missing_alt | integer | not null, default 0 |
| findings | jsonb | not null, default [] |
| created_at | timestamptz | not null, default now() |

Constraints: unique (`run_id`, `path`); non-negative counts; findings must be a JSON array. Index `run_id`.

## Authorization contract

Both tables must have RLS enabled. Access is restricted to signed-in users who have a matching row in the existing `public.admin_users` table (`admin_users.user_id = auth.uid()`). Do not rely on user-editable JWT user metadata.

- Runs: admin-only SELECT, INSERT, UPDATE. No DELETE in v1.
- Pages: admin-only SELECT and INSERT when the parent run belongs to the current user; UPDATE/DELETE disabled in v1.
- Child access must verify the parent run's `created_by = auth.uid()`, not merely that the caller is authenticated.
- Grant only the minimum Data API privileges required, alongside RLS policies. Confirm Data API exposure settings before implementation.

This is a single-admin pilot contract. Do not claim multi-workspace isolation until a real workspace membership model exists.

## Idempotency and write flow

1. Complete the crawl in bounded batches in the browser.
2. Create or upsert one run using (`created_by`, `idempotency_key`) and return its id.
3. Upsert page observations using (`run_id`, `path`).
4. Mark run completed or partial only after page writes finish.
5. On retry, reuse the same idempotency key; do not create a duplicate run.
6. If a write fails, preserve the crawl in memory for CSV export and report that persistence failed. Never show a success state for a failed database write.

## Acceptance tests before enabling the feature

- Anonymous user cannot read or write either table.
- Authenticated non-admin cannot read or write either table.
- Approved admin can create a run and insert its own page rows.
- Admin cannot read or modify another creator's rows.
- Duplicate run retry returns the same run rather than creating a duplicate.
- Duplicate page retry updates the same run/path record.
- Invalid source/scope/status and negative counts are rejected.
- A partial crawl is labelled partial; no missing pages are silently treated as successful.
- Data API grants and RLS policies are verified independently.
- Build, type checks, RLS tests and preview smoke tests pass.

## Rollout constraints

No migration has been generated or applied. The connected production Supabase project previously reported exhausted quota, and a separate staging database has not been verified. Do not apply this design to production. First establish a working isolated test project/database, create the migration through the Supabase CLI workflow, run the tests and advisors, then connect the admin UI behind a feature flag.

## Retention

Retention duration and deletion workflow are intentionally unresolved. Do not schedule cleanup or delete audit history until the owner approves a retention period.
