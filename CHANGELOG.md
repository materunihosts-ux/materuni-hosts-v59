# Changelog

## 2026-10-12 — v60 modernization branch

- Added a USD / EUR / TZS display selector with bounded exchange-rate lookup, six-hour session caching, USD fallback and estimate labels. Booking and database values remain USD.
- Added a factual Materuni Waterfall TouristAttraction structured-data entity; no unverified lodging/event schema or fabricated review badges were added.
- Reworked the guest booking form into three progressive steps while preserving existing field IDs and the transactional submit_booking RPC payload.
- Added direct WhatsApp booking shortcut.
- Improved guest booking acknowledgement email with a Google Maps search link and practical preparation guidance; it remains a booking request acknowledgement, not a payment receipt.
- Added modernization architecture and updated the Supabase work plan with a read-only live RLS policy review.
- No database schema, production bookings, payment configuration, live availability slots, or deployed Edge Functions were changed in this branch.
- Remaining work before production: idempotency key + concurrency tests, add-on schema/RPC, month-grid calendar aggregation, PDF generation, provider delivery tests, verified review data, WebP/AVIF image pipeline, and Lighthouse/PageSpeed measurement.


All notable project changes are recorded here.

## 2026-10-12 — v59 setup, booking and security audit

- Confirmed the booking RPC uses row locking and a single transaction to reserve capacity and insert the booking; frontend availability is advisory and the database RPC is authoritative.
- Confirmed cancellation and rescheduling lifecycle functions must remain transactional and must not change slot capacity twice.
- Updated booking feedback to distinguish a saved request from a confirmed reservation and to report notification delivery separately.
- Added a point-in-time availability integrity audit to the QA notes.
- Documented that some Astro scripts still embed the public Supabase URL/key and must be migrated to import.meta.env.PUBLIC_SUPABASE_URL and import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY.
- Reviewed deployed booking-notifications and guest-concierge functions. Both currently have JWT verification disabled and wildcard CORS. CORS is not authentication. The notification endpoint relies on an unguessable booking UUID, New status and a short creation-time window.
- Follow-up security work: idempotency for booking RPC retries; atomic rate limiting; provider request timeouts; strict input validation; safe provider-error logging; and automated concurrency and Edge Function tests.
- No production secrets, test bookings, or new availability slots were added.
- Edge Function source changes must be tested in a preview/local Supabase environment before production deployment. Do not claim provider delivery until Resend/WhatsApp are configured and live delivery passes.

## 2026-10-11 — Developer setup documentation

- Added .env.example, README and Swahili implementation guide.
- Documented Vercel production deployment and Netlify preview/testing workflow.
- Documented Supabase secret handling and Edge Function deployment commands.
