MATERUNI HOSTS — AVAILABILITY INTEGRATION

Current data model
- public.availability_slots: id, experience, slot_date, start_time, end_time, capacity, booked_count, is_active.
- public.bookings: slot_id, guest_count, booking_date, status and guest contact fields.
- Unique slot index: (experience, slot_date, start_time).

Guest availability lookup
The booking page queries active slots for the selected experience and date. It calculates remaining spaces as capacity - booked_count and displays only slots that can accommodate the requested guest count. It also filters past start times for the current date in Africa/Dar_es_Salaam.

IMPORTANT: frontend availability is advisory, not the final authority. Another guest may take the remaining spaces after the page has loaded. The database RPC is authoritative.

Atomic reservation / double-booking protection
public.submit_booking performs the following work in a single Postgres transaction:
1. Validates guest contact details, group size and request rate.
2. Selects the requested availability_slots row FOR UPDATE.
3. Validates that the slot exists, is active, matches the experience and date, and has enough remaining capacity.
4. Increments booked_count by the requested guest count.
5. Inserts the booking row with slot_id, guest_count and status New.
6. Returns the booking ID, human-readable reference and status.

Because the slot row is locked until the transaction commits, two simultaneous requests for the same slot cannot both consume the same final spaces. The second request re-reads the updated counter after obtaining the lock and is rejected if there is insufficient capacity. The capacity update and booking insert roll back together if either operation fails.

Admin lifecycle rules
- New/Pending requests already hold capacity.
- Confirming a request changes status only; it must NOT increment booked_count again.
- Cancelling New, Pending or Confirmed requests restores their guest count exactly once.
- Rescheduling a Confirmed booking locks both old and new slots in stable order, checks the new slot's capacity, transfers the guest count and updates the booking transactionally.
- Repeated cancellation returns safely without restoring capacity twice.

Do not modify booked_count manually and do not insert guest bookings directly from the browser. Use the existing secured RPC functions.

Known remaining hardening
- submit_booking currently does not accept a client idempotency key. A repeated submission after an ambiguous network timeout may create a second booking request (though the slot lock still protects capacity). Add an idempotency token with a unique database constraint before claiming retry-safe submissions.
- Run concurrent integration tests on a dedicated test slot before production release.
- Verify table grants and RLS keep direct guest writes disabled.

Live database review (current snapshot)
- 260 availability slots inspected.
- No over-capacity or negative counters found.
- The counter reconciliation query found no mismatch between booked_count and New/Pending/Confirmed booking guest totals.
- No test booking was created as part of this review.

Guest-facing messages
- No slots: “No times have been added for this date yet. Choose another date or contact our local host.”
- Group too large for remaining capacity: “No remaining slots fit your group. Try another date or a smaller group.”
- Race conflict at submission: “There are not enough spaces for this group. Please refresh availability and choose another time.”
- Success: “Booking request received — reference: [reference]. Your request is awaiting host confirmation; it is not yet a confirmed reservation and no payment has been taken.”
- Notification warning: “Your request is safely saved, but automatic email/WhatsApp delivery is not fully confirmed. Our host can verify it using your reference.”


## Retry safety / idempotency (2026-10-12)
Guest submissions now call `submit_booking_idempotent` with a client-generated UUID key. The database serializes requests sharing that key, stores a hash of the normalized payload, and maps the key to the resulting booking. An identical retry returns the same booking reference without consuming capacity twice; reusing the key with different details is rejected. The browser keeps the key and payload fingerprint in session storage across reloads/timeouts and removes it after a verified success.

The migration is `supabase/migrations/202610120001_booking_idempotency.sql` and has been applied to the linked Supabase project. The mapping table has RLS enabled and direct table privileges revoked; only the security-definer RPC can access it. No live test booking was retained. Automated concurrent/browser integration tests are still outstanding.
