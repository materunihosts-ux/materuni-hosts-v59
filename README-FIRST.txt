MATERUNI HOSTS — V55 QUALITY IMPROVEMENT PACKAGE

Project: Astro static frontend + Supabase backend
Target deployment: Vercel
Domain configured in public sitemap: https://materunihosts.com

WHAT WAS IMPROVED IN THIS PACKAGE
- Added Admin CMS editing for all six homepage FAQs; public FAQ text and FAQ structured data now update together.
- Added Admin CMS editing for the Sustainability page hero and four guiding-principle descriptions.
- Added a Guest Conversion overview to the existing admin dashboard. It calculates active enquiries, contacted/connected enquiries, confirmed/completed bookings and a clearly defined conversion rate from the live bookings already loaded by Admin.
- Added an indicative booking estimate that updates with the selected experience and guest count. It is an estimate only, not a quote, payment request or reservation confirmation.
- Updated the default price list in the frontend and Admin defaults: Waterfalls & Coffee $75, Coffee & Chagga Culture $65, Overnight Camping $110, Cooking & Culture $85, Cultural Day Trip $75, Ultimate Experience $135 per person.
- Removed Swahili from the guest-language selector; supported guest languages remain EN, ES, FR and DE.
- Updated cache-busting references and service-worker cache version to V55 so older V47 assets are not reused.
- Added positive-number validation for editable package prices.
- Preserved existing Supabase booking records and existing Admin modules. No database rows were deleted or changed by preparing this ZIP.

IMPORTANT DEPLOYMENT / FUNCTIONALITY NOTES
1. Production Astro build has NOT been verified in this environment. `npm install` repeatedly timed out, so `npm run build` could not be run here. Do not treat this ZIP as a proven successful production build until Vercel's build log reports success.
2. This project intentionally keeps real photos under Admin upload control. The archive contains the official logo but does not invent or generate experience photographs. Upload genuine Materuni photos in Admin before launch.
3. Existing `site_content` values in Supabase take precedence over frontend defaults. If older package prices are already saved there, open Admin > Website editor, check all six prices and save the intended current prices.
4. The existing chat panel prepares guest-initiated WhatsApp messages; it is not an AI chatbot and does not send messages automatically.
5. Partner invitation buttons open a prepared email/WhatsApp draft for a human to review and send. They are not automated email or WhatsApp delivery.
6. Admin can display AI conversation records if the backend receives them, but this frontend package does not implement a live AI model endpoint. Real AI replies, automated email and WhatsApp delivery require secure server-side services and provider credentials. Do not add secret keys to frontend files.
7. Online payments are not enabled. Booking form submissions remain enquiries and are not automatically confirmed.

VERCEL
- Import the project repository into Vercel.
- Framework preset: Astro
- Build command: npm run build
- Output directory: dist
- No environment variables are needed for the existing public Supabase read/booking requests in this frontend; the public publishable key is already used. Never add a Supabase service-role key to the browser.
- Confirm the build log succeeds before assigning the production domain.

QA COMPLETED LOCALLY
- ZIP integrity check: passed after packaging.
- JavaScript syntax checks: passed for site.js, language.js, service worker and Admin inline script.
- Static checks: FAQ/CMS bindings, sustainability CMS bindings, conversion panel, sitemap/robots/manifest syntax and local asset/link references reviewed.
- Browser-based visual interaction test: not available in this environment.
- Astro production build: not verified because dependency installation timed out.
