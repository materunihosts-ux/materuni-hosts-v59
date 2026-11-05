# Materuni Hosts — Release Readiness & Quality Checklist

## Current release boundary

- Work is being prepared on `business-os/phase-0-foundation`.
- Changes are preview-only. Do not promote to production without explicit owner approval.
- No Supabase schema migration or live business-data mutation was performed during this review.
- A Vercel `READY` state confirms the build completed; it does not prove authenticated workflows or visual behaviour are correct on every device.

## Workspace ownership

- Public Website Dashboard: public page content, landing pages, experience catalogue and published prices, media, host information and website settings.
- Business OS: bookings, guest inbox, tour availability, private commercial rates/documents, SEO/growth work, AI tools, performance insights and approval safeguards.
- Experience copy, imagery and public prices must not be duplicated in the availability manager.
- Booking dates and capacity must not be edited in the public catalogue.

## Manual acceptance checks before production

### Access and navigation
- [ ] Sign in with an authorised administrator.
- [ ] Confirm a non-admin account is rejected even if Supabase authentication succeeds.
- [ ] Confirm password reset works from the Business OS.
- [ ] Confirm navigation between the two workspaces is clear and does not send users to duplicate tools.
- [ ] Confirm sign-out is reachable on desktop and mobile.
- [ ] Confirm Business OS task search filters both Operations and Growth cards and gives a useful empty state.

### Public website dashboard
- [ ] Edit and save one public content item, then verify the public page.
- [ ] Create/edit an experience and verify its public name, description, image, inclusions and price.
- [ ] Upload a real local photo and confirm the stored image URL loads on the public site.
- [ ] Confirm public prices match the approved catalogue; do not invent a TZS price for Overnight Village.
- [ ] Confirm website settings and contact links are correct.

### Business operations
- [ ] Publish one future availability date and a short date range.
- [ ] Confirm a range is limited to 90 dates inclusive.
- [ ] Confirm an existing matching slot is skipped rather than duplicated.
- [ ] Confirm the list shows the correct experience name, Tanzania-local date, time and remaining capacity.
- [ ] Close and reopen a slot; verify the saved state after refreshing.
- [ ] Submit a real test booking only with owner approval, then verify capacity reservation, confirmation, cancellation and rescheduling.
- [ ] Confirm notifications show their actual delivery status; never treat a queued or failed notification as sent.
- [ ] Verify quotations, invoices, payment records and exports with test records before using them for real customers.

### Growth, AI and reporting
- [ ] Run the on-page audit and inspect its findings against the live public pages.
- [ ] Verify SEO metadata saves and appears in the rendered page source.
- [ ] Treat keyword ideas as hypotheses until a verified search-data provider is connected.
- [ ] Verify analytics against source booking records; distinguish estimated booking value from money received.
- [ ] Do not represent local browser drafts as cloud-saved or published content.
- [ ] Do not represent AI, Search Console sync, social publishing, durable approvals or CRM automation as active until end-to-end tests pass.

## Read-only data and security review (2026-11-05)

- The availability table contained 261 records, all in the past, with zero future slots at the time of inspection. There were no exact duplicate combinations of experience, date, start time and end time. Publish current future availability before relying on the public booking calendar.
- Supabase security advisors reported six RLS-enabled tables with no policies. These may be intentionally inaccessible through the Data API, but confirm their intended access model before production.
- The advisor reported a warning for leaked-password protection being disabled. Enable and test this in Supabase Auth settings before production.
- The advisor reported several `SECURITY DEFINER` RPC functions callable by authenticated users. A read-only source inspection found explicit `admin_users` allowlist checks and a fixed `search_path` in the reviewed admin RPCs; keep those checks and review every privileged function when changing database code.
- The public booking RPCs are security-definer functions by design, but must remain narrowly validated, rate-limited and idempotent. Review the legacy `create_smart_booking` function and its grants before relying on it.
- The performance advisor reported unused indexes and multiple permissive read policies on guest reviews. Do not drop indexes or alter policies without query evidence and a reviewed migration.

## Known limitations

- The Vercel preview is protected. Authenticated browser-level visual testing was not available during this review.
- The availability manager has not yet been exercised end-to-end with administrator credentials.
- Database and external integrations were inspected read-only; no schema or settings changes were made.
- Production deployment remains a separate approval step.
