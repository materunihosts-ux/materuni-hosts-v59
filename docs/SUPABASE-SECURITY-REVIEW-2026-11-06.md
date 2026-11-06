# Materuni Hosts — Supabase security review

**Reviewed:** 2026-11-06  
**Environment:** Connected Supabase project `sskmzswoeljxwojcszta` (production project; read-only review only)  
**Branch:** `intelligence-os/foundation-audit-2026-11-06`

## Scope and safety

This review queried Supabase Security and Performance Advisors and inspected selected PostgreSQL function definitions and ACLs. No SQL writes, migrations, policy changes, grants, revocations, or production configuration changes were made.

## Current advisor findings

### 1. RLS enabled without policies — 6 tables

Advisor reports RLS enabled but no policies on:

- `public.ai_conversations`
- `public.ai_messages`
- `public.booking_idempotency`
- `public.guest_chat_rate_limits`
- `public.guest_profiles`
- `public.notification_logs`

This is not automatically a vulnerability: if no API role has table privileges, the tables may be intentionally inaccessible directly. Verify table grants and all application access paths before adding policies. In particular, the admin conversation RPCs use SECURITY DEFINER and perform an explicit `admin_users` membership check.

### 2. Public booking RPC — intentional public entry point, needs focused abuse review

Advisor flags `public.submit_booking_idempotent(...)` because `anon` can execute a SECURITY DEFINER function.

Inspection confirmed:
- The function requires a non-null idempotency UUID.
- It hashes the request payload and locks on the idempotency key.
- Reusing the same key with different details is rejected.
- It delegates to `submit_booking(...)`.
- The underlying `submit_booking` has an ACL that does not grant anon execution directly; the idempotent SECURITY DEFINER wrapper invokes it.
- The booking function validates experience, guest count (1–30), guest name, at least one contact method, active/future slot, experience match, and remaining capacity; it also applies a per-contact request limit.

**Decision:** do not revoke anon execution without checking the public booking form, as this RPC appears to be the intended public booking submission path. Next review should test abuse resistance, input length bounds, idempotency expiry/retention, and whether IP-based throttling is required. Do not expose the underlying `submit_booking` RPC to anon.

### 3. SECURITY DEFINER admin RPCs — 16 authenticated-callable functions

Advisor flags 16 functions callable by authenticated users. Selected definitions inspected include booking administration, analytics, AI conversation readers, and `is_materuni_admin()`.

The selected admin functions check `admin_users.user_id = auth.uid()` before returning data or mutating bookings. This is a positive authorization control, but the remaining flagged functions still need the same per-function body review. Do not blanket-revoke authenticated execution: the admin dashboard may depend on these RPCs.

### 4. Leaked password protection

Supabase Auth reports leaked-password protection disabled. This is an Auth configuration change, not a SQL migration. Enable only after checking the current plan and user sign-in impact; it is not changed in this review.

### 5. Performance advisories

- 22 indexes are currently reported unused.
- `public.guest_reviews` has two permissive authenticated SELECT policies.

Do not drop indexes based only on this advisory: usage counters can reset and infrequently used booking/operations indexes may still be important. Review query plans and workload history first. The duplicate permissive policy should be checked for overlap and semantics before consolidation.

## Recommended remediation order

1. Inspect table-level grants for the six RLS/no-policy tables and confirm which roles can reach them through the Data API.
2. Review every SECURITY DEFINER function body and its EXECUTE ACL; retain only the intended public booking wrapper and authenticated admin RPCs.
3. Test the public booking RPC with valid, invalid, repeated, and conflicting idempotency requests in an isolated database.
4. Review Auth leaked-password protection and enable it through Auth settings after confirming impact.
5. Review guest_reviews policies and unused indexes with query plans before any change.

## Release gate

No production database change is approved by this review. Database changes must first be validated in an isolated Supabase development environment, then reviewed and tested before a separately approved production rollout.
