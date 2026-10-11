# Materuni Hosts — Guest concierge setup

## Current status
- The Supabase Edge Function `guest-concierge` is deployed and active.
- The floating concierge widget is included on public pages and hidden on private admin pages.
- Supported chat languages: English (`en`), Spanish (`es`), French (`fr`) and German (`de`).
- Conversations are stored in `ai_conversations` and `ai_messages`.
- Each browser session receives an opaque server-issued token; only its hash is stored in the database. Requests are rate-limited by IP and per conversation.
- The assistant is grounded in the approved six experiences and prices. It must not claim that a booking is confirmed, invent availability, promise transport inclusions, or invent licences, ratings or awards.

## Enable AI-generated replies
Add this Supabase Edge Function secret:
- `OPENAI_API_KEY` — API key for the OpenAI account that will power the concierge.

Optional:
- `OPENAI_MODEL` — model name. Defaults to `gpt-4o-mini`.

Without the OpenAI key, the widget remains available in guided fallback mode with approved answers about prices, booking, transport, payment and the Materuni waterfall. It does not claim to be generating AI replies until the API key is configured.

## Important
- Never put the OpenAI key or Supabase service-role key in browser code or GitHub.
- The concierge does not take bookings or payments. It directs visitors to the availability form, itinerary builder or a local host on WhatsApp.
- The chat language selector does not yet translate every page on the website; full page localisation remains a separate task.
