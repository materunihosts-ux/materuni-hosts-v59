# Materuni Hosts — Expanded SECURITY DEFINER and Data API Review

**Date:** 2026-11-06  
**Branch:** `intelligence-os/foundation-audit-2026-11-06`  
**Supabase project:** `sskmzswoeljxwojcszta`  
**Mode:** Read-only inspection. No SQL writes, migrations, grants, revocations, policy changes, or Auth configuration changes.

## Executive summary

The latest advisor output flags 16 authenticated-callable SECURITY DEFINER functions, one anon-callable SECURITY DEFINER function, and six RLS-enabled tables without policies. Inspection of all public SECURITY DEFINER function definitions and ACLs shows that the flagged functions are not all equivalent:

- The public booking wrapper is anon-callable and appears to be the intended guest booking entry point.
- The underlying `submit_booking` function is **not** anon-callable in its ACL; the wrapper invokes it with definer privileges.
- The authenticated-callable admin functions inspected contain explicit checks against `public.admin_users` using `auth.uid()`.
- The six RLS/no-policy tables currently grant table privileges only to `postgres` and `service_role`; no `anon` or `authenticated` table grants appeared in `information_schema.role_table_grants`. This materially reduces the likelihood of direct Data API exposure, but RPC access paths and service-role code still require review.

This report records concrete follow-up issues; it does not authorize production changes.

## 1. Six RLS-enabled tables without policies: grant check

Tables checked:

- `ai_conversations`
- `ai_messages`
- `booking_idempotency`
- `guest_chat_rate_limits`
- `guest_profiles`
- `notification_logs`

For each table, the role-grant query returned privileges for `postgres` and `service_role` only. It returned no table grants for `anon` or `authenticated`.

**Assessment:** do not add permissive RLS policies merely to silence the advisor. RLS with no policies is a deny-by-default posture for ordinary roles. Keep these tables inaccessible directly unless a specific authenticated direct-access use case is proven. Server-side service-role access must remain protected and must perform its own authorization where user-controlled input can select records.

The admin RPCs that read AI conversations, guest profiles, and notification logs perform an explicit `admin_users` membership check. Their use should be tested with a real non-admin authenticated account as well as an admin account.

## 2. SECURITY DEFINER functions and observed ACLs

All public SECURITY DEFINER functions were enumerated. The following groups were observed:

### Public guest booking

- `submit_booking_idempotent(...)`: ACL includes `anon` and `service_role`.
- `submit_booking(...)`: ACL includes `postgres` and `service_role`; no anon or authenticated grant observed.

The wrapper validates a non-null idempotency key, hashes request details, takes an advisory transaction lock, rejects reuse of a key with different details, and calls `submit_booking`. The underlying function checks required booking fields, guest count (1–30), active/future slot, experience match, capacity, and a per-contact hourly request threshold.

**Assessment:** retain the public wrapper as a candidate intended public API; do not revoke anon access without first migrating and testing the website booking form. Keep the underlying function unexposed to anon. Add isolated tests for concurrent submissions, replay, mismatched replay, malformed contact details, overlong fields, and rate-limit behavior.

### Authenticated admin functions

The following functions have authenticated EXECUTE grants and were found to check membership in `public.admin_users` using `auth.uid()`:

- `admin_cancel_booking`
- `admin_confirm_booking`
- `admin_create_availability_slot`
- `admin_delete_booking`
- `admin_get_ai_conversations`
- `admin_get_ai_messages`
- `admin_get_analytics`
- `admin_get_booking_calendar`
- `admin_get_bookings`
- `admin_get_guest_profiles`
- `admin_get_notification_logs`
- `admin_reschedule_booking`
- `admin_save_experience_location`
- `admin_save_translation`
- `admin_update_ai_conversation_status`
- `is_materuni_admin`

**Assessment:** the advisor warning is not, by itself, proof of an authorization bypass. The explicit membership checks are positive. Continue function-by-function authorization testing; avoid blanket revocations that would break the admin dashboard.

### Service-role-only functions

- `create_smart_booking` and `submit_booking` were observed without anon/authenticated EXECUTE grants. Keep this separation unless a documented client path requires a change.

## 3. Concrete hardening candidates found in function bodies

These are review findings, not changes already applied.

| Priority | Function | Observation | Recommended next step |
|---|---|---|---|
| High | `admin_get_guest_profiles` | Returns all guest profiles with no LIMIT or pagination | Add bounded pagination or a hard result limit; verify admin UI pagination and totals |
| Medium | `admin_get_ai_messages` | Orders ascending and limits to 200, which returns the oldest 200 messages for long conversations | Change UI/API contract to fetch latest messages or cursor pages while preserving chronological display |
| Medium | `admin_save_translation` | Validates language code but has no visible bounds for content key or translated text | Define sensible length limits and reject blank keys/content where appropriate |
| Medium | `admin_create_availability_slot` | Checks non-empty experience, capacity below 1, end-after-start and no past dates; no visible maximum capacity or maximum future horizon | Add bounds after confirming business rules and table constraints |
| Medium | `admin_save_experience_location` | Validates non-empty experience/name and latitude/longitude ranges; no visible maximum lengths or URL scheme validation for map URL | Bound text fields and accept only intended map URL schemes |
| Medium | `admin_get_notification_logs` | Fixed 200-row limit but no pagination; includes recipient and error message | Add cursor pagination and minimize PII exposure in UI/log exports |
| Low | `admin_get_ai_conversations` | Fixed 200-row limit | Add cursor pagination if the dashboard needs older conversations |
| Low | `admin_get_bookings`, `admin_get_booking_calendar` | Date ranges are bounded to at most 365 days | Preserve these bounds and test boundary dates/timezone behavior |

The `admin_delete_booking` function restricts permanent deletion to cancelled or past bookings. The cancellation and rescheduling functions lock booking/slot rows and adjust capacity. These flows still need concurrency and capacity-invariant tests before being treated as fully verified.

## 4. Function security posture

Observed SECURITY DEFINER functions set `search_path` to `public, pg_temp`, which is preferable to an uncontrolled search path. Continue checking every function for:
- explicit authorization appropriate to the caller;
- fully schema-qualified object references;
- safe handling of NULL and malformed inputs;
- bounded result sets;
- correct row locks and transaction invariants;
- least-privilege EXECUTE ACLs;
- no untrusted dynamic SQL.

The advisor listed 16 authenticated-callable functions; the full catalog query also showed service-role-only and owner-only functions. Do not interpret the total SECURITY DEFINER count as the number of exposed functions.

## 5. Performance and Auth advisories

- 22 indexes were reported unused. Do not drop them without workload history, query plans, and knowledge of infrequent booking/admin operations.
- `guest_reviews` has two permissive authenticated SELECT policies. Compare their predicates and consolidate only if semantics are demonstrably equivalent.
- Leaked-password protection is disabled. This is an Auth dashboard/configuration task, not a SQL migration; review sign-in impact and plan availability before enabling.

## 6. Recommended engineering sequence

1. Add bounded pagination for guest profiles and conversation messages, with UI compatibility tests.
2. Add input length and URL validation to admin translation/location writes after confirming actual content requirements.
3. Build isolated SQL tests for booking idempotency, capacity invariants, admin authorization, cancellation, confirmation, and rescheduling.
4. Verify direct table grants and API exposure again after each schema change.
5. Review the two permissive guest-review policies and unused indexes with actual query plans.
6. Only then prepare a migration and test it in a separate development project.

## 7. Release and data-safety status

No production database change was made. No migration was created or applied. No data was inserted, updated, or deleted. This review used read-only catalog queries and Supabase advisor results.

Production rollout remains blocked until an isolated test database is available, the migration is tested, and the user explicitly approves the production change.
