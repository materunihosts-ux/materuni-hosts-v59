# Materuni Hosts v60 — modernization architecture

## Delivery principles

- Keep the current Astro static site and the existing Supabase project. This is a refinement, not a database replacement.
- Treat Supabase as the source of truth for catalogue prices, availability, booking state and private guest records.
- Never place the Supabase service-role key, provider API keys, database passwords or payment credentials in browser code or any PUBLIC_ variable.
- Do not claim an online payment, reservation confirmation, review score, certification, award, or availability unless the connected system has verified it.
- English, Spanish, French and German are supported. Swahili is intentionally not offered as a website language.
- USD is the canonical catalogue and booking currency. EUR/TZS are approximate display conversions only; booking requests and host quotes remain denominated in USD until a payment/currency settlement provider is integrated.

## Current architecture

AstRO static pages + global CSS
  - SiteLayout: SEO metadata, language, currency display, concierge and navigation
  - Homepage / experiences / itinerary / booking
  - Admin pages (Supabase Auth session + admin RPCs)
       | publishable key only
       v
Supabase PostgREST + Auth
  - experience_catalog (public active catalogue)
  - availability_slots (public active future slot read)
  - submit_booking RPC (authoritative transactional reservation)
  - admin_* RPCs (admin-only operations)
  - RLS-protected guest, marketing and notification data
  - Storage: materuni-images
       |
       v
Supabase Edge Functions
  - booking-notifications (email / WhatsApp provider adapters)
  - guest-concierge (guided fallback + optional AI provider)

## Changes in this branch

### International UX

- Retain the four-language selector: EN, ES, FR, DE.
- Add a persistent USD / EUR / TZS display selector.
- Fetch USD exchange rates from a public exchange-rate endpoint with a six-hour session cache and a bounded timeout.
- When the rate endpoint is unavailable, prices fall back to USD rather than showing invented conversion rates.
- Browser-origin allowlists are checked by both public Edge Function handlers through the ALLOWED_ORIGINS Supabase secret. This is defense-in-depth only; it is not authentication.
- Converted prices are marked as estimates. They do not change database amounts, RPC payloads, provider settlement currency or payment instructions.

### Booking UX

- Turn the existing booking form into three progressive steps without changing input IDs or the submit_booking RPC contract:
  1. Experience, date, live slot and party size.
  2. Guest contact details.
  3. Pickup, special requests and submission.
- Keep the database RPC authoritative. Client availability is a snapshot and can become stale between display and submit.
- Capacity reservation and booking insertion must remain in one database transaction under a row lock.
- A proper idempotency key is still required to make network retries safe against duplicate request creation. It must be added to the database and RPC together; do not simulate it only in browser storage.

### SEO and structured data

- Keep canonical URLs, Open Graph, Twitter metadata, breadcrumb schema and sitemap.
- Add a factual TouristAttraction entity for Materuni Waterfall.
- Do not add LodgingBusiness or recurring Event schema until verified lodging inventory / a real dated public event exists. Structured data must describe an actual service or event, not a ranking trick.
- Sitemap and robots remain public; admin URLs remain disallowed and noindex.

## Booking engine: next production-grade steps

1. Add idempotency_key UUID NOT NULL to booking requests after confirming existing rows and default/backfill.
2. Add a unique constraint for the guest request key.
3. Extend submit_booking with a key and return the existing booking reference on a safe retry.
4. Keep the current row lock and transaction; reject a different request when capacity is exhausted.
5. Add concurrency tests against one disposable slot.
6. Add lifecycle tests for confirm, cancel, delete and reschedule to prove booked_count changes exactly once.
7. If the calendar needs a month grid with open/full day states, expose an aggregate read-only calendar RPC; current booking UI checks the selected date and available times.
8. Add-ons and per-night pricing must be stored in an admin-managed catalogue and validated/recalculated inside the server RPC. Do not trust a browser-supplied total. The current booking RPC accepts one experience slot and does not yet persist arbitrary add-ons or a multi-night line-item breakdown.

## Supabase security snapshot (read-only review)

Policies observed in the live project:
- bookings: authenticated SELECT/UPDATE/DELETE require a matching admin_users.user_id = auth.uid(); anonymous users have no booking SELECT policy. Guest creation is through the booking RPC.
- availability_slots: public reads are restricted to active, future slots within 365 days; writes require is_materuni_admin().
- experience_catalog: public reads are restricted to active rows; writes require is_materuni_admin().
- site_content: public SELECT is enabled. Confirm that this table contains only public website content, never guest PII or private operational notes.
- marketing_contacts: all observed operations require admin membership.
- guest_profiles, ai_conversations, ai_messages, guest_chat_rate_limits, notification_logs: RLS is enabled and no policies were found in the read-only policy listing. This is fail-closed for API roles; Edge Functions using service-role bypass RLS and must validate input and restrict returned fields.
- site_settings: public SELECT policies expose selected FAQ, approach, language and social-link settings. A performance advisor reported overlapping permissive SELECT policies; consolidate only after checking all current public keys.

Security Advisor also warns that submit_booking is SECURITY DEFINER and executable by anon. This is expected for public guest booking only if the function validates every field, has a fixed safe search_path, limits what it inserts/returns and cannot perform admin actions. Review its full definition before changing grants. Admin SECURITY DEFINER RPCs must independently verify is_materuni_admin() or an equivalent membership check inside the function body.

## Email / PDF / payments

- Booking notification success must be reported separately from booking persistence.
- Email should say “request received / awaiting host confirmation” until a host confirms.
- A booking summary PDF, route map, packing advice and payment receipt are different documents. Do not label an unpaid booking summary as a payment receipt.
- A payment receipt must only be generated from a verified payment-provider transaction and include its provider reference.
- PDF attachment generation is not yet part of the deployed notification flow; implement it only after choosing and testing a PDF generation runtime/library.

## Performance / media

- No video backgrounds. Use a single compressed hero image, explicit width/height, eager/high priority for the hero and lazy loading for below-the-fold galleries.
- Convert original, licensed photographs to AVIF/WebP in a build pipeline and retain a JPEG fallback. Verify every final asset path before replacing current Supabase URLs.
- Use responsive image sizes; do not send a full-resolution source image to mobile.
- PageSpeed 95+ is a target, not a guarantee. It must be measured on deployed production URLs using Lighthouse/PageSpeed Insights on mobile and desktop.

## Social proof

- Use real, attributable guest reviews only.
- Google / Tripadvisor badges must link to verified listings and show current score / review count only when confirmed and kept updated.
- The current site supports social links and a guest reviews page; do not hardcode fabricated ratings or testimonials.

## Deployment and verification

1. Run npm ci, npm run check, and npm run build.
2. Review the preview deployment on mobile and desktop.
3. Test language switching and currency fallback when the FX endpoint is blocked.
4. Test booking success, full capacity, stale slot, invalid details, API failure and notification-provider failure.
5. Run RLS tests as anon, authenticated non-admin and admin.
6. Deploy Edge Functions only after local/preview tests and verify logs and real provider delivery.
7. Keep the current production deployment available for rollback until acceptance tests pass.
