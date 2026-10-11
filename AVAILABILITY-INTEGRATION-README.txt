MATERUNI HOSTS — LIVE AVAILABILITY INTEGRATION (V57)

What changed
- Guest booking form now checks the existing public Supabase table: public.availability_slots.
- It filters active slots by the selected date and exact experience name.
- It only displays a slot when remaining capacity is exposed by available_spaces, available_capacity, spaces_left, or capacity minus booked_count/bookings_count.
- It requires a guest to choose a published session before submitting a booking request.
- It re-reads the chosen slot immediately before inserting the booking, then stores slot_id and guest_count with the existing booking fields.
- It does not mark the booking Confirmed; the host still approves it in Admin.

Expected existing fields (based on the existing Admin booking calendar output and booking schema)
- availability_slots: id, slot_date, experience, start_time, end_time, capacity, is_active
- Capacity information must be available as available_spaces / available_capacity / spaces_left, or capacity plus booked_count / bookings_count.
- bookings: existing fields plus slot_id and guest_count (already present in the supplied project audit).

Important limitation
- This frontend reads and rechecks the existing table; it does not create or alter Supabase tables, policies, triggers, or functions.
- A browser-side recheck is not an atomic capacity lock. Two guests could theoretically select the final space at nearly the same time. A database transaction/RPC is required for a strict no-double-booking guarantee. Do not claim race-proof reservations until that database-side transaction is installed and tested.
- If the live table does not expose one of the remaining-capacity fields above, the UI deliberately refuses to invent free spaces and tells the guest to contact the host.

Before production
1. Confirm the existing availability_slots columns match the expected fields above.
2. Ensure the public SELECT policy permits active future slots only.
3. Ensure bookings INSERT policy accepts slot_id and guest_count and validates that the selected slot is still available (ideally with a database trigger or transactional RPC).
4. Create at least one active future slot per experience in Admin and test the public booking page.
5. Test a full slot, inactive slot, missing slot, and two simultaneous booking attempts.
