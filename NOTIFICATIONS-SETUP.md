# Materuni Hosts — Instant messaging & email automation

## What the website does now
- The guest-facing host chat and floating WhatsApp actions open WhatsApp with a prefilled enquiry message (guest-initiated instant messaging).
- After a booking enquiry is saved, the frontend calls the Supabase Edge Function `booking-notifications` using the saved booking UUID.
- The function looks up the saved booking server-side and can send an acknowledgement to the guest plus a new-enquiry alert to the business email through Resend.
- It can send a WhatsApp alert to the business number using WhatsApp Cloud API and an approved message template.
- Delivery attempts are written to `notification_logs` where its existing schema permits.

## Deploy the Supabase function
From the project root, with Supabase CLI linked to project `sskmzswoeljxwojcszta`:

```bash
supabase functions deploy booking-notifications --no-verify-jwt
```

The function validates the booking UUID against the database using the server-only service-role key. Never put service-role credentials in frontend code.

## Configure secrets (Supabase Edge Function secrets)
Required for email:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (server-side only)
- `RESEND_API_KEY`
- `EMAIL_FROM` — a sender address on a domain verified with Resend, e.g. `Materuni Hosts <bookings@materunihosts.com>` after domain verification
- `ADMIN_NOTIFICATION_EMAIL` — the inbox that receives new booking alerts

Optional for automatic WhatsApp admin alerts:
- `WHATSAPP_ACCESS_TOKEN`
- `WHATSAPP_PHONE_NUMBER_ID`
- `WHATSAPP_ADMIN_NUMBER` — digits with country code, e.g. 2556…
- `WHATSAPP_BOOKING_TEMPLATE` — approved Meta WhatsApp template name with five body variables in this order: guest, experience, date, guest count, guest phone
- `WHATSAPP_TEMPLATE_LANGUAGE` — defaults to `en`

Set with `supabase secrets set NAME=value ...` or the Supabase Dashboard Edge Function secrets UI. Do not commit secrets to this repository.

## WhatsApp rules
The website's click-to-chat is available immediately and requires the guest to press Send in WhatsApp. Automatic business-initiated notifications require a WhatsApp Business Platform account, a connected phone number, an access token, and an approved template. This package does not claim WhatsApp API delivery until configured and tested.

## Email rules
Email automation requires a Resend account, verified sending domain, API key, and sender address. The function sends the guest acknowledgement and business alert after the booking row is saved. If email credentials are absent or delivery fails, the booking remains saved and the response reports notification status separately.

## Test checklist
1. Deploy the Edge Function and set secrets.
2. Submit one test booking with an email address you control.
3. Confirm the booking appears in Admin.
4. Confirm the guest acknowledgement and admin alert arrive (also inspect spam).
5. Configure the WhatsApp template and test the business alert.
6. Inspect `notification_logs` for delivery outcomes.
7. Remove test bookings only if they are clearly identified as test records and after confirming with the site owner.
