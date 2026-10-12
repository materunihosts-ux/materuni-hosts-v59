# Materuni Hosts — Supabase integration audit & completion plan

## Important safety rule

This package is based on the existing V48 project and the V49 dashboard improvements. It must connect to the existing Supabase project `sskmzswoeljxwojcszta`. Do not create a replacement project, reset the database, truncate tables, delete bookings, or replace the existing `bookings` table.

The existing booking form was previously tested successfully after granting `INSERT` to `anon` and `authenticated`. The previously observed booking status totals were 9 New, 1 Confirmed and 1 Cancelled (11 total at that time). Recheck the live counts before making any schema changes.

## What the frontend currently expects

- `public.bookings` — public enquiry insert; authenticated admin select/update; protected confirmation/cancellation RPC actions.
- `public.availability_slots` — start/end time lookup for bookings and admin availability calendar.
- `public.site_content` — CMS copy, package details, social links and photo URLs.
- Storage bucket `materuni-images` — public image delivery; authenticated admin image uploads.
- `public.marketing_contacts` — private admin-only partner contact list.
- Admin RPCs called by the dashboard: `admin_confirm_booking`, `admin_cancel_booking`, `admin_get_analytics`, `admin_get_booking_calendar`, `admin_get_guest_profiles`, `admin_get_notification_logs`, `admin_get_ai_conversations`.

The current frontend calls all five operations RPCs independently. V49 now reports a missing/denied module separately instead of hiding every other module when one RPC fails.

## First required action — read-only audit

1. Open Supabase Dashboard → SQL Editor → New query.
2. Open `supabase/00_READ_ONLY_AUDIT.sql` from this package.
3. Copy all SQL into the editor and run it.
4. Save/copy the results for each section and send them back here.

This audit is SELECT-only. It reports table existence, columns, RLS, policies, grants, admin RPC signatures, Storage bucket/policies and booking status totals. It does not modify data.

## Completion stages after audit results

1. **Booking security:** verify INSERT remains limited to `status = 'New'` and required fields; verify authenticated admin SELECT/UPDATE/DELETE policies check membership in `admin_users`; keep anon without SELECT/UPDATE/DELETE.
2. **Booking lifecycle:** inspect existing confirmation/cancellation functions before changing them. Confirmed bookings should use the protected RPC so slot capacity and timestamps are handled consistently. Do not replace functions until their current definitions and table relationships are known.
3. **Availability:** verify slot schema, active flags, capacity, booked counts, date/time zones and whether the public form actually selects/locks a slot. Avoid inventing slot columns or capacity rules.
4. **CMS:** verify `site_content` primary key and admin-only write policy; public read should expose only intended website content.
5. **Images:** verify `materuni-images` is public for reads and authenticated admin-only for uploads; restrict image types to JPEG/PNG/WebP and size to 5 MB. Check the actual public URLs before changing frontend image logic.
6. **Partners:** verify `marketing_contacts` is private and admin-only for read/write.
7. **Operations/CRM/notifications/AI:** install or repair each RPC only after confirming the real underlying tables and column names. Missing optional modules must not block booking management.
8. **End-to-end test:** submit a new test enquiry; verify it appears in admin; update New → Contacted; test confirmation/cancellation only against a disposable test booking; upload one test image; update one CMS text field; verify public site reads the saved values.

## Do not paste secrets

Never share a Supabase `service_role` key, database password, user password, or private token. The publishable/anon key in browser code is expected to be public; security must come from RLS and server-side functions.

## Deployment caution

V49 is a source package, not a live deployment. Deploy only after the SQL audit confirms compatibility and the local Astro production build passes. Keep the currently working deployment available as rollback until all tests pass.


## v60 live security review (2026-10-12)

A read-only pg_policies review confirmed the current access boundaries:
- bookings SELECT/UPDATE/DELETE policies require the authenticated user's ID to exist in admin_users; public guest submission is through submit_booking, not public booking-table reads.
- availability_slots public reads are limited to active future slots within the next 365 days; writes are admin-only through is_materuni_admin() policies.
- experience_catalog public reads are limited to active experiences; mutations are admin-only.
- marketing_contacts operations are restricted to admin membership.
- site_content is publicly readable; ensure it contains only public-facing copy and media references, never guest PII.
- RLS is enabled without policies on guest_profiles, ai_conversations, ai_messages, guest_chat_rate_limits and notification_logs. These are fail-closed for ordinary API roles; service-role Edge Functions bypass RLS and must enforce their own authorization and field selection.
- site_settings exposes selected public keys, but overlapping permissive SELECT policies were reported by the performance advisor. Consolidate only after reviewing all settings used by the site.

Security Advisor flags public execution of the SECURITY DEFINER submit_booking RPC. This can be intentional for guest checkout, but only if its function body validates all inputs, uses a fixed safe search_path, returns minimal data, and has no admin capabilities. Review every admin SECURITY DEFINER body for an internal admin membership check before changing grants. Do not blindly revoke public execute from the guest booking RPC, because that would break public booking.

Do not add RLS policies to the private AI/notification tables merely to clear the advisor: service-role Edge Functions can continue to access them while browser roles remain denied. Add narrowly scoped policies only if a verified authenticated user-facing use case requires them.
