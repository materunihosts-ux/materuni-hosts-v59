# Materuni Hosts V59 — Setup & Implementation Guide

Mwongozo huu unaeleza jinsi developer mpya anavyoweza kuandaa, kuendesha, kupima na ku-deploy mradi bila kuvuruga Supabase au booking records zilizopo.

## 1. Teknolojia na muundo

- **Frontend:** Astro (static output) + HTML/CSS/JavaScript + TypeScript checks.
- **Backend:** Supabase (PostgreSQL, Auth, REST API, RPC, Storage na Edge Functions).
- **Production hosting:** Vercel.
- **Temporary preview/testing:** Netlify.
- **Package manager:** npm.
- **Production domain:** https://materunihosts.com

Astro imewekwa `output: "static"`; build huzalisha tovuti ndani ya `dist/`. Supabase ndiyo backend ya bookings, availability, CMS, admin na guest concierge.

## 2. Mahitaji ya kompyuta

1. Node.js LTS na npm.
2. Git.
3. Code editor kama VS Code.
4. Ufikiaji wa GitHub repository na Supabase project iliyopo.
5. Vercel access kwa production deployment.

**Usitengeneze Supabase project mpya.** Mradi huu unatakiwa kuendelea kutumia project iliyopo yenye reference `sskmzswoeljxwojcszta`. Usifanye reset, truncate au kufuta bookings.

## 3. Kupata code na ku-install

```bash
git clone https://github.com/materunihosts-ux/materuni-hosts-v59.git
cd materuni-hosts-v59
npm install
```

Tengeneza local environment file:

```bash
cp .env.example .env
```

Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Jaza values kutoka Supabase Dashboard. **Tahadhari ya sasa:** baadhi ya Astro page scripts bado zina Supabase URL na publishable key kama constants ndani ya source. Kwa hiyo `.env` peke yake bado hai-overwrite constants hizo. Kabla ya kutegemea environment variables, developer anatakiwa kumalizia migration ya scripts zote kwenda `import.meta.env.PUBLIC_SUPABASE_URL` na `import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY`, kisha kuthibitisha bundle iliyojengwa. Usidai kuwa config ya local imefanya kazi bila kuipima.

## 4. Environment variables

Angalia faili [.env.example](./.env.example). Lina makundi matatu:

### Public Astro configuration

- `PUBLIC_SUPABASE_URL` — URL ya Supabase project.
- `PUBLIC_SUPABASE_PUBLISHABLE_KEY` — publishable key (au legacy anon key) ya browser client.
- `PUBLIC_SITE_URL` — hiari; public site URL kwa tooling itakayohitaji.

Prefix `PUBLIC_` humaanisha thamani inaweza kuingia kwenye browser bundle. Weka hapa tu thamani ambazo zinaruhusiwa kuwa public.

### Supabase Edge Function secrets

- `OPENAI_API_KEY`, `OPENAI_MODEL` — optional AI concierge.
- `RESEND_API_KEY`, `EMAIL_FROM`, `ADMIN_NOTIFICATION_EMAIL` — booking email.
- `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ADMIN_NUMBER`, `WHATSAPP_BOOKING_TEMPLATE`, `WHATSAPP_TEMPLATE_LANGUAGE` — WhatsApp Cloud API.
- Supabase hosted Edge Functions hupata `SUPABASE_URL` na `SUPABASE_SERVICE_ROLE_KEY` kutoka Supabase runtime.

Hizi ni secrets za server. Ziweke kupitia Supabase Edge Function secrets, si kwenye Astro browser code, GitHub, au `PUBLIC_` variables. Kwa mfano:

```bash
supabase secrets set OPENAI_API_KEY=...
supabase secrets set RESEND_API_KEY=...
supabase secrets set EMAIL_FROM="Materuni Hosts <bookings@your-domain.com>"
supabase secrets set ADMIN_NOTIFICATION_EMAIL=...
```

### Netlify na Vercel

Vercel huweka deployment metadata zake yenyewe kama `VERCEL_ENV` na `VERCEL_URL`. Netlify huweka `CONTEXT`, `URL`, `DEPLOY_URL` na `SITE_ID`. Hizi hazihitaji kuandikwa kwenye `.env` kwa static build ya sasa. Hakuna Vercel token au Netlify personal access token inayotakiwa ndani ya browser. Netlify ni ya testing tu; Vercel ndiyo production.

## 5. Kuendesha na kujenga mradi

Development:

```bash
npm run dev
```

Quality/type checks:

```bash
npm run check
```

Production build:

```bash
npm run build
```

Preview ya build:

```bash
npm run preview
```

Build output inapaswa kuwa `dist/`. Usipeleke production kama `npm run check` au `npm run build` zina errors.

## 6. Supabase — maeneo muhimu

Backend iliyopo inategemea resources zifuatazo (thibitisha schema halisi kabla ya kubadilisha):

- `experience_catalog` — experiences na public prices.
- `availability_slots` — tarehe, muda, capacity na nafasi.
- `submit_booking` RPC — kupokea booking request.
- `bookings` — taarifa za maombi ya wageni na booking status.
- `site_content` na `site_settings` — CMS na social settings.
- `admin_users` — orodha ya akaunti zilizoidhinishwa kwa admin.
- `materuni-images` — picha za website.
- Tables za guest concierge na notification logs.

Usibadilishe schema, RLS, grants au RPC bila kusoma definitions na policies zilizopo. Anza na read-only audit iliyoelezwa kwenye [SUPABASE-COMPLETE-WORK-PLAN.md](./SUPABASE-COMPLETE-WORK-PLAN.md).

## 7. Edge Functions na integrations

### Booking notifications

`booking-notifications` hutuma email kupitia Resend na WhatsApp kupitia Meta Cloud API ikiwa credentials na template vimewekwa. Function inaweza kuwa deployed lakini delivery haimaanishi kuwa provider credentials tayari zimewekwa.

Fuata [NOTIFICATIONS-SETUP.md](./NOTIFICATIONS-SETUP.md).

### Guest concierge

`guest-concierge` ina guided fallback; AI-generated replies zinahitaji `OPENAI_API_KEY`. Fuata [GUEST-CONCIERGE-SETUP.md](./GUEST-CONCIERGE-SETUP.md).

Deploy functions kwa project iliyopo:

```bash
supabase functions deploy booking-notifications --project-ref sskmzswoeljxwojcszta
supabase functions deploy guest-concierge --project-ref sskmzswoeljxwojcszta
```

## 8. Vercel production deployment

1. Import GitHub repository `materunihosts-ux/materuni-hosts-v59`.
2. Framework preset: Astro.
3. Root directory: repository root.
4. Build command: `npm run build`.
5. Output directory: `dist`.
6. Deploy preview kwanza.
7. Angalia build logs, browser console, network requests, booking flow na admin login.
8. Baada ya QA kupita ndipo thibitisha production domain.

## 9. Netlify testing deployment

Netlify ni ya preview/testing tu. Tumia:

- Build command: `npm run build`
- Publish directory: `dist`

Usibadilishe production DNS kwenda Netlify kwa sababu tu preview imefanikiwa.

## 10. Checklist ya QA

- [ ] `npm run check` imepita.
- [ ] `npm run build` imepita.
- [ ] Experience catalogue inasomeka.
- [ ] Availability inaonyesha active slots zenye nafasi za kutosha tu.
- [ ] Booking request inarudisha reference.
- [ ] Booking inaonekana kwenye admin.
- [ ] Admin login inaruhusu admin aliyeidhinishwa tu.
- [ ] Booking haiji-confirm yenyewe bila host.
- [ ] Email/WhatsApp failures haziwezi kufuta booking iliyohifadhiwa.
- [ ] Concierge fallback inafanya kazi bila OpenAI key.
- [ ] Hakuna secret kwenye frontend bundle au Git.
- [ ] Mobile, accessibility, links na browser console vimekaguliwa.

Tumia taarifa za majaribio tu; usijaribu kwa taarifa binafsi za mteja halisi.

## 11. Nyaraka za ziada

- [README.md](./README.md) — mwongozo mkuu wa developer kwa Kiingereza.
- [AVAILABILITY-INTEGRATION-README.txt](./AVAILABILITY-INTEGRATION-README.txt) — booking availability.
- [SUPABASE-COMPLETE-WORK-PLAN.md](./SUPABASE-COMPLETE-WORK-PLAN.md) — Supabase audit.
- [NOTIFICATIONS-SETUP.md](./NOTIFICATIONS-SETUP.md) — email na WhatsApp.
- [GUEST-CONCIERGE-SETUP.md](./GUEST-CONCIERGE-SETUP.md) — AI concierge.
