# Materuni Hosts — Database Security and Booking Regression Test Matrix

**Status:** Test specification prepared; tests have not yet been executed.  
**Environment:** Must run against an isolated Supabase project, never the live booking database.  
**Branch:** `intelligence-os/foundation-audit-2026-11-06`

## Test setup requirements

Use disposable test users and clearly marked synthetic bookings, availability slots, guest profiles, conversations, and notification records. Never use real guest contact details. Capture the initial slot capacity and booking counts so every test can assert that the database returns to its original state. Run each mutation test inside a transaction where possible, or use a disposable project that can be reset.

Required identities:
- unauthenticated/anon caller;
- authenticated non-admin caller;
- authenticated admin caller present in `public.admin_users`;
- service-role caller used only in server-side test harnesses.

## A. Public booking RPC

Target: `submit_booking_idempotent` (anon is an intended caller candidate).

| Case | Input/action | Expected result |
|---|---|---|
| A01 | Valid future active slot, valid contact, 1 guest, new UUID | One New booking; booked_count increases by 1 |
| A02 | Repeat exact same payload and same UUID | Same booking ID/reference; booked_count unchanged |
| A03 | Same UUID but change guest count or email | Rejected; no second booking; capacity unchanged |
| A04 | Null idempotency UUID | Rejected |
| A05 | Guest count 0, negative, or 31 | Rejected |
| A06 | Blank guest name | Rejected |
| A07 | Both email and phone blank | Rejected |
| A08 | Slot inactive | Rejected |
| A09 | Slot in the past or beyond 365 days | Rejected |
| A10 | Experience differs from slot | Rejected |
| A11 | Requested group exceeds remaining capacity | Rejected; booked_count unchanged |
| A12 | Two concurrent requests compete for the final capacity | At most one request succeeds; capacity never exceeds slot capacity |
| A13 | Five requests already exist for same contact in the last hour | Next request rejected |
| A14 | Underlying `submit_booking` called directly as anon | Permission denied |
| A15 | Replayed idempotency key after booking is cancelled/deleted | Behavior is explicitly documented and safe; no duplicate reservation or misleading stale response |

Important: A15 requires inspection of foreign-key behavior and idempotency retention. Do not delete or expire idempotency records until a safe retention policy is established.

## B. Admin authorization and read isolation

For every admin RPC, run once as anon, once as authenticated non-admin, and once as authenticated admin.

- Anon must not execute admin functions unless a documented public use case exists.
- Authenticated non-admin must receive an authorization failure and must not learn private records.
- Admin should receive only the expected, bounded result set.
- Verify the `admin_users` membership check is based on the signed-in caller's `auth.uid()`, not a client-supplied user ID.

Functions:
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

## C. Booking lifecycle and capacity invariants

For a test slot with known capacity C, booked count B, and booking guest count G:

1. New valid booking: B becomes B + G.
2. Confirm already-reserved booking: B remains unchanged.
3. Cancel active booking: B becomes max(0, B - G), exactly once.
4. Cancel already-cancelled booking: B remains unchanged.
5. Reschedule confirmed booking: old slot decreases by G and new slot increases by G in the same transaction.
6. Failed reschedule: both slot counts and booking assignment remain unchanged.
7. Concurrent confirmation/cancellation/reschedule operations must not create negative counts or counts above capacity.
8. Permanent deletion of a cancelled booking must not restore capacity a second time.
9. Permanent deletion of a future active booking must be rejected.
10. Experience and date must remain consistent between booking and assigned slot.

## D. Input-boundary tests for admin write functions

- `admin_create_availability_slot`: blank experience; null/zero/negative capacity; unreasonable capacity; end time before/equal to start; past date; excessive future date; very long experience key.
- `admin_save_experience_location`: blank name; latitude/longitude outside legal ranges; extremely long description; malformed map URL; non-HTTPS URL if external maps should be HTTPS only.
- `admin_save_translation`: unsupported language; blank key; oversized key; empty translation; oversized translation; Unicode and accented characters.
- `admin_update_ai_conversation_status`: unsupported status; missing conversation; non-admin caller.

Set exact maximum lengths only after reviewing actual UI requirements and existing stored values; do not arbitrarily truncate live content.

## E. Pagination and result ordering

- `admin_get_guest_profiles`: verify result bounds and stable pagination; no full-table response.
- `admin_get_ai_messages`: create more than 200 messages; ensure the most recent messages can be retrieved and displayed chronologically. Current function's ascending order plus LIMIT 200 returns the oldest messages.
- `admin_get_ai_conversations`: verify newest-first order and stable pagination.
- `admin_get_notification_logs`: verify newest-first order, bounded pagination, and whether recipient/error fields should be masked in ordinary dashboard views.
- `admin_get_bookings` and `admin_get_booking_calendar`: verify date-window maximums and timezone boundaries.

## F. Direct Data API grants and RLS

For `ai_conversations`, `ai_messages`, `booking_idempotency`, `guest_chat_rate_limits`, `guest_profiles`, and `notification_logs`:

- Confirm anon and authenticated roles have no direct table privileges unless a documented use case requires them.
- Confirm service-role access is limited to server-side code and never bundled into browser assets.
- Confirm direct REST requests cannot bypass the intended RPC authorization checks.
- Re-run Supabase advisors after any changes.

## G. Pass criteria

A test suite passes only when:
- no non-admin caller can read or mutate admin-only data;
- public booking requests cannot exceed slot capacity under concurrency;
- idempotent retries do not create duplicate bookings;
- failed operations leave booking and slot state unchanged;
- result sets are bounded and can page to newer/older data correctly;
- no service-role secret appears in client bundles;
- all test data is cleaned from the isolated environment.

## Explicit non-goals

Do not use production guests, bookings, or availability slots for these tests. Do not run destructive SQL against production. Do not change grants, policies, function definitions, Auth settings, or indexes until the isolated tests pass and a separate production rollout is approved.
