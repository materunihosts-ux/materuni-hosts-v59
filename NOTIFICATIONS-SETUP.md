# Materuni Hosts — Booking notifications

## Current implementation
- The Supabase Edge Function `booking-notifications` is deployed and active in project `sskmzswoeljxwojcszta`.
- The public booking page calls the function after `submit_booking` saves a new request.
- The function looks up the booking server-side using the Supabase service-role key; the key is never exposed in the browser.
- It accepts only a valid booking UUID for a new booking created within the previous 30 minutes.
- Delivery attempts are written to `notification_logs`; duplicate successful or in-progress sends are blocked by a partial unique index.
- The Admin booking page shows the latest email and WhatsApp delivery outcomes.
- The function is deployed with JWT verification disabled because guests submit bookings without signing in. Its custom checks require a valid, unguessable booking UUID, a recent creation timestamp and status `New`. It must not be used as a general messaging endpoint.

## Email setup (Resend)
Add these as Supabase Edge Function secrets:
- `RESEND_API_KEY` — API key from Resend.
- `EMAIL_FROM` — sender address on a domain verified with Resend, e.g. `Materuni Hosts <bookings@materunihosts.com>`.
- `ADMIN_NOTIFICATION_EMAIL` — inbox for new booking alerts.

When configured, the function sends:
1. A guest acknowledgement confirming receipt (not a confirmed reservation and no payment taken).
2. A new booking alert to the admin inbox.

Supabase provides `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to Edge Functions; never copy the service-role key into frontend code or GitHub.

## WhatsApp Cloud API setup
Add these secrets only after the WhatsApp Business Platform phone number is connected:
- `WHATSAPP_ACCESS_TOKEN`
- `WHATSAPP_PHONE_NUMBER_ID`
- `WHATSAPP_ADMIN_NUMBER` — recipient digits with country code, e.g. `2556…`.
- `WHATSAPP_BOOKING_TEMPLATE` — approved Meta template name with five body variables in this order: guest, experience, date, guest count, guest phone.
- `WHATSAPP_TEMPLATE_LANGUAGE` — optional; defaults to `en`.

The business alert uses the approved template. It will not send until the token, phone number ID, recipient number and template are all configured.

## Guest-initiated WhatsApp
Website WhatsApp buttons open a prefilled chat. The guest must press Send in WhatsApp; this is separate from automatic WhatsApp Business API notifications.

## Test checklist
1. Add the Resend secrets and verify the sending domain.
2. Submit one booking using an email address you control.
3. Check that the booking appears in Admin and that the notification log shows `sent`.
4. Check the guest acknowledgement and admin alert (including spam).
5. Configure the approved WhatsApp template and test the admin alert.
6. Inspect notification logs for `sent`, `failed` or `skipped` states.

**Important:** the function is deployed, but real email and WhatsApp delivery is not active until the provider credentials and sender/template setup above are supplied and a live test passes.
