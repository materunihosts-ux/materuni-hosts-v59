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

## Partner invitation automation (Email + WhatsApp)
- Supabase Edge Function `admin-communications` is deployed with JWT verification enabled and checks the signed-in user against `public.admin_users` before it can send anything.
- In Admin → Partners, each partner card has **Send invitation**. It sends the saved partner invitation email and, when WhatsApp is configured, a Meta WhatsApp Business template message.
- In Admin → Email Studio, edit the **Partner invitation · Boutique collaboration** email template. Its subject and body are stored in `site_settings.email_templates`; supported merge tags include `{{partner_name}}`, `{{host_name}}`, `{{reply_email}}`, and `{{whatsapp}}`.
- Email/WhatsApp delivery attempts are recorded in `public.communication_logs` and visible in Email Studio → Recent invitation deliveries. The log table is RLS protected; only authorised admins can read it.

### Additional WhatsApp setup
Keep the existing booking alert secrets above. For partner invitations, configure these Supabase Edge Function secrets:
- `WHATSAPP_ACCESS_TOKEN` — long-lived Meta WhatsApp Cloud API access token.
- `WHATSAPP_PHONE_NUMBER_ID` — WhatsApp Business phone number ID.
- `PUBLIC_WHATSAPP_NUMBER` — Materuni Hosts public contact number (defaults to +255 612 068 540).
- Optional `HOST_CONTACT_NAME` — name/signature used in invitation email.
- Optional `EMAIL_REPLY_TO` — reply-to address (defaults to hello@materunihosts.com).

Then open Admin → Email Studio → WhatsApp Business Automation and save the exact approved Meta template name and language code. The approved Meta template must have **three body variables, in this order**: partner business name, contact person, Materuni Hosts WhatsApp number. The template name is a normal setting, not a secret. Meta approval is required before sending.

### Sending behaviour and test
1. Add a partner record with a valid email and WhatsApp number.
2. Save the partner invitation email subject/body in Email Studio.
3. Save the approved WhatsApp template name and language.
4. Click **Send invitation** on that partner's card. The function reports email and WhatsApp outcomes independently; one channel can succeed while the other is skipped or fails.
5. Review Email Studio → Recent invitation deliveries for provider IDs, status and any error message.

**Provider boundary:** the application and secure automation are deployed, but real delivery requires a verified Resend sender/API key and the Meta WhatsApp Cloud API credentials plus an approved template. The website cannot create Meta approval or provider credentials itself.
