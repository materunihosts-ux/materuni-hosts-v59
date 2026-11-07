# Materuni Intelligence OS — Live Database Baseline

Snapshot date: 2026-11-06  
Supabase project ref: `sskmzswoeljxwojcszta`  
Access type: read-only schema inspection and advisor queries. No SQL writes, migrations, policy changes, function deployments, or data mutations were performed.

## SEO keyword table

The existing `public.seo_keywords` table is present and has RLS enabled.

Columns observed:

| Column | Type | Nullable/default |
|---|---|---|
| id | uuid | not null, generated UUID |
| keyword | text | not null |
| intent | text | not null, default informational |
| cluster | text | nullable |
| target_url | text | nullable |
| search_volume | integer | nullable |
| difficulty | numeric | nullable |
| current_position | numeric | nullable |
| clicks | integer | not null, default 0 |
| impressions | integer | not null, default 0 |
| priority | text | not null, default medium |
| status | text | not null, default research |
| source | text | not null, default manual |
| notes | text | nullable |
| created_at | timestamptz | not null, default now() |
| updated_at | timestamptz | not null, default now() |

Existing policy observed:
- `SEO admins full access` for `authenticated`, with both USING and WITH CHECK tied to membership in `public.admin_users` using `auth.uid()`.

Data-quality snapshot:
- 8 keyword records currently exist.
- All 8 are `source=manual` and `status=research`.
- None has a search-volume value.
- None has a current-position value.
- Recorded clicks and impressions total zero.

Interpretation: this is currently a manual keyword planning library, not a live rank tracker or Search Console data store. Do not display the empty/default metric fields as measured Google performance.

## Current Supabase advisor snapshot

### Security advisor

- 6 RLS-enabled tables have no policies: `ai_conversations`, `ai_messages`, `booking_idempotency`, `guest_chat_rate_limits`, `guest_profiles`, and `notification_logs`.
- 1 SECURITY DEFINER function is executable by `anon`: `submit_booking_idempotent`. This may be an intentional public booking RPC; inspect its body, input validation, rate limits and grants before any change.
- 16 SECURITY DEFINER functions are executable by `authenticated`. This warning is not proof of a vulnerability. Review each function's body, authorization check, intended callers and grants individually. Do not revoke all grants in bulk.
- Leaked-password protection is reported disabled.

Remediation references:
- [RLS enabled without policy](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)
- [SECURITY DEFINER callable by anon](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable)
- [SECURITY DEFINER callable by authenticated](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable)
- [Leaked password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)

### Performance advisor

- 22 indexes are reported unused in the advisor's observed workload window.
- One multiple-permissive-policy warning exists on `public.guest_reviews` for authenticated SELECT, involving the admin-read and published-review policies.

Do not delete unused indexes based only on this notice. Review table size, query plans, workload window, constraints and infrequent admin/reporting use first.

Reference:
- [Multiple permissive policies](https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies)

## Foundation decision

1. Reuse `seo_keywords` for its current purpose; do not replace it.
2. Treat `source`, `status`, timestamps and provenance as important data-quality fields.
3. Before adding crawl-run or observation tables, inspect all existing tables and migration history for overlap.
4. Keep all new data behind admin-only server-side operations or narrowly scoped RLS policies.
5. Never make the six no-policy tables publicly accessible merely to silence the advisor.
6. Review SECURITY DEFINER functions one by one, beginning with the public booking RPC only if booking/security work is in scope.
7. Do not modify the live Supabase project as part of the initial SEO foundation until a separate test/preview database path and migration review are agreed.

## Verification limits

The schema, policy metadata, keyword aggregate and advisors were read from the connected Supabase project. This snapshot does not include a full function-body audit, SQL query-plan analysis, live authentication tests, or a production attack simulation.
