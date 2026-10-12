# Materuni Hosts

Astro static website for Materuni Hosts, with Supabase as the backend for bookings, availability, admin operations, website content, guest conversations and media.

- **Production hosting target:** Vercel
- **Temporary testing only:** Netlify
- **Production domain:** https://materunihosts.com
- **Supabase project reference:** `sskmzswoeljxwojcszta`
- **Node package manager:** npm

## 1. Prerequisites

Install:
- Node.js LTS (use the version supported by the Astro version in `package.json`)
- npm (bundled with Node.js)
- Git
- A Supabase account with access to the existing Materuni Hosts project

Do not create a replacement Supabase project for this repository. Existing booking and customer data belongs to the current project.

## 2. Clone and install

```bash
git clone https://github.com/materunihosts-ux/materuni-hosts-v59.git
cd materuni-hosts-v59
npm install
```

Copy the environment template:

```bash
cp .env.example .env
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Fill in the values from the existing Supabase project dashboard. Never commit `.env`.

> **Important configuration audit:** The public Supabase URL and publishable key are currently embedded as constants in some existing Astro page scripts. The `.env.example` documents the intended standard variable names, but adding values to `.env` alone does not override those existing constants until the affected scripts are migrated to `import.meta.env.PUBLIC_SUPABASE_URL` and `import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Do not assume local environment changes have taken effect without checking the compiled bundle and a live request. This migration must be completed consistently across booking, shared layout and admin pages.

## 3. Run locally

```bash
npm run dev
```

Astro prints the local development URL (normally http://localhost:4321).

Before opening a pull request or deploying, run:

```bash
npm run check
npm run build
npm run preview
```

The production output is written to `dist/`. Fix all type, build and runtime errors before deployment.

## 4. Supabase architecture and configuration

The website uses the existing Supabase project. Main backend resources used by the application include:

- `experience_catalog` — published experience names and prices
- `availability_slots` — public date/time/capacity lookup
- `submit_booking` — booking request RPC
- `bookings` — guest booking requests and admin lifecycle
- `site_content` / `site_settings` — CMS and public website settings
- `admin_users` — administrator allow-list
- `materuni-images` — public experience image delivery and admin uploads
- Guest concierge tables and notification logs used by their Edge Functions

Do not reset, truncate, replace or recreate production tables. Make schema changes only after a read-only audit, review existing policies/functions, and take a backup.

### Public browser credentials

A Supabase publishable key (or legacy anon key) is designed to be visible in a browser. It is not an admin credential. Enable Row Level Security and enforce least-privilege policies on every exposed table and RPC.

### Secrets — server-side only

Never expose any of the following to browser code, HTML, public assets, Git history or client-side environment variables:

- Supabase service-role / secret key
- OpenAI API key
- Resend API key
- WhatsApp Cloud API access token
- Database password or private provider tokens

For deployed Supabase Edge Functions, configure secrets in Supabase rather than Vercel/Netlify browser variables:

```bash
supabase secrets set OPENAI_API_KEY=...
supabase secrets set OPENAI_MODEL=gpt-4o-mini
supabase secrets set RESEND_API_KEY=...
supabase secrets set EMAIL_FROM="Materuni Hosts <bookings@your-domain.com>"
supabase secrets set ADMIN_NOTIFICATION_EMAIL=...
supabase secrets set WHATSAPP_ACCESS_TOKEN=...
supabase secrets set WHATSAPP_PHONE_NUMBER_ID=...
supabase secrets set WHATSAPP_ADMIN_NUMBER=255...
supabase secrets set WHATSAPP_BOOKING_TEMPLATE=...
supabase secrets set WHATSAPP_TEMPLATE_LANGUAGE=en
```

Supabase supplies `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to hosted Edge Functions. Do not manually copy the service-role key into the frontend. For local function testing, use the Supabase CLI's local function secrets file and keep it out of Git.

See [NOTIFICATIONS-SETUP.md](./NOTIFICATIONS-SETUP.md) and [GUEST-CONCIERGE-SETUP.md](./GUEST-CONCIERGE-SETUP.md) for provider-specific setup and test steps.

## 5. Deploy to Vercel (production)

1. Push the reviewed branch to GitHub.
2. In Vercel, import `materunihosts-ux/materuni-hosts-v59`.
3. Select the Astro framework preset.
4. Set the project root to the repository root.
5. Build command: `npm run build`.
6. Output directory: `dist`.
7. Deploy a preview first; inspect the build log and test the preview.
8. Add/verify the production domain `materunihosts.com` only after QA passes.

Vercel automatically provides its deployment metadata variables. The current static Astro build does not require a custom Vercel token or a Vercel API secret in the website environment.

## 6. Netlify (testing only)

Netlify is retained only as a temporary preview/testing destination, not the production host. If a test deploy is needed, import the same repository and use:

- Build command: `npm run build`
- Publish directory: `dist`

Netlify provides its own deployment metadata variables automatically. No Netlify personal access token should be placed in the browser environment. Do not change production DNS or treat a Netlify preview as the live website.

## 7. Supabase Edge Functions

Functions currently present in the repository:

- `booking-notifications` — sends configured booking email/WhatsApp notifications after a booking is saved.
- `guest-concierge` — guest chat endpoint with guided fallback and optional OpenAI-generated responses.

Deploy/update only after reviewing the function source and confirming required database tables and policies exist. Example:

```bash
supabase functions deploy booking-notifications --project-ref sskmzswoeljxwojcszta
supabase functions deploy guest-concierge --project-ref sskmzswoeljxwojcszta
```

A deployed function does not mean provider delivery is enabled. Email requires verified sender/domain and Resend secrets. WhatsApp requires a configured Cloud API number and approved template. AI replies require an OpenAI key. Run real tests and inspect function logs.

## 8. Booking and admin QA checklist

- [ ] Experience catalogue loads from the existing Supabase project.
- [ ] Availability appears only for active slots with enough remaining capacity.
- [ ] Past times and full slots cannot be selected.
- [ ] Submitting a booking returns a booking reference.
- [ ] A saved request appears in the admin booking dashboard.
- [ ] A booking remains a request until an authorised admin confirms it.
- [ ] Admin login rejects users not present in `admin_users`.
- [ ] Admin can manage experiences and availability without exposing private records publicly.
- [ ] Notification failures are reported separately from booking-save success.
- [ ] Concierge works in fallback mode without an OpenAI key.
- [ ] Email/WhatsApp delivery is only marked successful after provider confirmation.
- [ ] Mobile layout, keyboard navigation, contrast, links and console/network errors are checked.

Never use a real customer's personal details for test bookings. Use a clearly identified test record and remove it only through an approved cleanup process.

## 9. Project structure

```text
.
├── public/                  # Static assets, service worker, robots and sitemap
├── src/
│   ├── layouts/              # Shared Astro layout
│   └── pages/                # Public pages and /admin routes
├── supabase/
│   └── functions/            # Supabase Edge Functions
├── .env.example              # Safe configuration template (no live secrets)
├── astro.config.mjs
├── package.json
├── vercel.json
└── README.md
```

## 10. Working safely as a new developer

1. Read this README, then [V59-IMPLEMENTATION-GUIDE-SW.md](./V59-IMPLEMENTATION-GUIDE-SW.md).
2. Read the booking, notification and concierge setup notes before changing backend behavior.
3. Inspect the current Supabase schema, RLS policies and RPC definitions before editing SQL.
4. Keep changes small and focused; do not duplicate shared logic or introduce a second booking flow.
5. Run `npm run check` and `npm run build` after each meaningful change.
6. Test with a preview deployment before production.
7. Keep credentials in the hosting/provider secret manager, never in commits or screenshots.
8. Document schema changes, environment requirements and rollback steps in the same pull request.

## Useful project documents

- [Swahili implementation guide](./V59-IMPLEMENTATION-GUIDE-SW.md)
- [Availability integration notes](./AVAILABILITY-INTEGRATION-README.txt)
- [Supabase audit and work plan](./SUPABASE-COMPLETE-WORK-PLAN.md)
- [Booking notifications](./NOTIFICATIONS-SETUP.md)
- [Guest concierge](./GUEST-CONCIERGE-SETUP.md)
