# Supabase Security Review — Verified Detail Addendum

Review date: 2026-11-04. This was a read-only inspection. No live SQL, policies, grants, Auth settings, bookings, or deployments were changed.

## SECURITY DEFINER execution grants

Catalog ACL inspection found:

| Function | Explicit execution roles | Interpretation |
|---|---|---|
| `submit_booking_idempotent(...)` | anon, service_role | Public booking submission RPC; preserve only if required by the public booking form |
| `submit_booking(...)` | service_role | Internal submission routine |
| `create_smart_booking(...)` | service_role | Internal booking routine |
| Admin-prefixed RPCs | authenticated, service_role | Function bodies must enforce admin allowlist authorization |
| `is_materuni_admin()` | authenticated, service_role | Checks signed-in user against admin_users |

The inspected admin function bodies reference both `admin_users` and `auth.uid()`. This is a useful inventory signal, but each complete function still needs manual review and negative tests with anon and a non-admin authenticated user. Do not bulk-revoke or change function security mode: that can break existing dashboard operations.

## Guest reviews policies

Live policy inspection shows:
- Public SELECT for anon and authenticated is limited to `is_published = true`.
- Admin SELECT for authenticated uses `is_materuni_admin()` and exposes all reviews to approved admins.
- Admin INSERT, UPDATE and DELETE policies use `is_materuni_admin()`.

The advisor's multiple-permissive-SELECT warning is explained by the overlap for approved admins: both the public published-only SELECT and admin all-reviews SELECT apply. This appears intentional for an admin review manager. Do not remove either policy without testing that public visitors still see published reviews and admins can still see unpublished reviews.

## Six RLS tables without policies

`ai_conversations`, `ai_messages`, `booking_idempotency`, `guest_chat_rate_limits`, `guest_profiles`, and `notification_logs` have RLS enabled but no policies. This blocks direct browser-role access and may be correct if they are server-only. Map their Edge Function/RPC callers before changing anything.

## Auth and performance

- Leaked-password protection is disabled. Enable it in Supabase Auth password/security settings after validating the account recovery flow.
- 25 unused-index notices are not sufficient evidence for deletion. Review query plans and workload first.

## Next safe validation sequence

1. Run negative authorization tests for every admin SECURITY DEFINER RPC as anon and as a normal authenticated account.
2. Run positive tests as an approved admin against preview/test data.
3. Trace the six RLS-isolated tables to their actual service-role or RPC callers.
4. Test public published-review visibility and admin unpublished-review visibility.
5. Only then prepare a migration proposal for explicit review. No production migration is authorized by this report.
