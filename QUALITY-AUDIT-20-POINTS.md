# Materuni Hosts — International Standards Website Audit (20 Points)

**Branch:** `quality/14-point-hardening`  
**Base:** `main`  
**Deployment:** deliberately deferred. No production deploy, DNS change, CDN activation, Supabase migration or Edge Function deployment is included in this work.

This is an implementation and release-readiness audit, not a legal opinion, penetration-test certificate, WCAG conformance certificate or hosting-provider attestation. A source-code check cannot prove live service behaviour.

## UI/UX and performance

1. **Page speed / Core Web Vitals — SOURCE IMPROVEMENTS MADE; FIELD TARGET UNVERIFIED.** Homepage hero output reduced to 1280×800 WebP quality 72; unused Cormorant webfont request removed; responsive media overflow protections retained. The target of a two-second load is not guaranteed. Still required: Lighthouse mobile and desktop on the deployed site, LCP/INP/CLS review, image waterfall, cache and real-user field data. Aim for Google's CWV good thresholds (LCP ≤2.5s, INP ≤200ms, CLS ≤0.1 at the 75th percentile), not a blanket promise for every visitor.
2. **Mobile responsiveness — SOURCE BASELINE PRESENT; DEVICE TEST PENDING.** Main shell breakpoints and overflow protection exist. Test public pages, booking flow, chat, cookie controls and admin tables at 320, 360, 390, 768, 1024 and 1440 CSS pixels, including zoom and touch.
3. **Intuitive navigation / three-click discoverability — PARTLY PRESENT.** Shared navigation, accessible menu state, Escape handling, focus return and direct booking CTA exist. Task-based audit remains for finding experience details, inclusions, price, location, availability, cancellation terms and contact within three clicks.
4. **Cross-browser compatibility — NOT VERIFIED.** Run functional checks on current Chrome, Safari/iOS, Firefox, Edge and Android Chrome. Include forms, local/session storage, date inputs, menus, language selection, consent and concierge.
5. **Cross-border CDN — PROVIDER CONFIGURATION REQUIRED.** Source has long-lived immutable caching for versioned static assets in the existing hosting configuration. No Cloudflare/AWS global CDN, DNS proxy, edge locations, Brotli, origin shielding or geographic latency has been independently verified. Do not publicly cache admin, booking, API or guest-specific responses.

## Security and compliance

6. **SSL/HTTPS — CONFIGURATION PRESENT; LIVE TLS UNVERIFIED.** Canonical URLs use HTTPS and the existing hosting configuration specifies HSTS. Verify certificate chain/renewal, HTTP→HTTPS redirect, www/apex consistency, mixed content, TLS protocol and HSTS behaviour on the actual domain.
7. **Privacy / GDPR / CCPA / cookie consent — CODE IMPROVED; LEGAL REVIEW REQUIRED.** Optional GTM analytics are gated behind consent; accept/reject/settings and withdrawal controls are present; privacy notice now explains rights, provider processing, international transfers, retention approach and how to reopen settings. Applicability, lawful basis, controller details, processor agreements, retention schedule, DSAR operations, CCPA/CPRA sale/share definitions and transfer mechanisms require a qualified privacy review. No compliance certification is claimed.
8. **Legal terms, copyright and terms of use — CONTENT BASELINE ADDED; LAWYER REVIEW REQUIRED.** Booking terms now include website content/copyright, third-party service and applicable-law wording. Verify every operational promise, refund/cancellation rule, tax statement and business identity with the owner and Tanzanian legal counsel before publication as a binding contract. Third-party photographs, fonts, logos and media need a maintained licence/permission register.
9. **Penetration testing / VAPT — NOT PERFORMED.** No active penetration test was conducted. Arrange an authorised scoped test before accepting online payments or sensitive documents. Include OWASP ASVS/WSTG coverage for authentication, access control, booking RPCs, Supabase RLS, Edge Functions, rate limits, injection, secrets, storage and admin. Fix findings and retest; do not describe CI or an advisor scan as a pentest.
10. **Disaster recovery / backup — NOT VERIFIED.** Confirm Supabase database backup/PITR entitlement and schedule, Storage object backup, retention, encryption, recovery credentials, RPO/RTO and restoration runbook. Perform a restore drill to a separate test project. A backup setting without a tested restore is not a recovery plan.

## Globalization and fiscal

11. **Language, currency and localization — PARTLY PRESENT.** Language selector supports English, Spanish, French and German with translation fallback/content support. Public prices are quoted in USD; TZS equivalent is confirmed manually at the prevailing rate. There is no verified automatic FX feed or full locale-aware date/number/currency switch for every component. Do not show stale exchange rates. Test translated metadata/content, date inputs, time zone and keyboard/screen-reader labels for each locale.
12. **Tax and card-fraud compliance — NOT IMPLEMENTED / NOT CURRENTLY IN SCOPE.** Website currently accepts booking enquiries and does not collect card payments. No multi-country VAT/sales-tax engine, card gateway, 3-D Secure/SCA, PCI scope assessment, fraud scoring or chargeback workflow is evidenced. Before enabling card payments, determine tax nexus/obligations with an accountant and choose a regulated provider or merchant of record that supports the business, currencies, refunds and fraud controls.
13. **API and third-party resilience — PARTLY PRESENT; FAILURE TESTS PENDING.** Concierge has a catalogue-grounded fallback and public social-link lookups have local fallbacks. Test Supabase, AI provider, email, WhatsApp and analytics outages, timeouts, retries, idempotency and user-visible error messages. Booking must never appear confirmed merely because a provider timed out; no private data should be exposed in error output.

## SEO and analytics

14. **Technical SEO — SOURCE BASELINE PRESENT; LIVE CRAWL PENDING.** Sitemap, robots.txt, canonical metadata, page metadata and TourOperator/WebPage/Breadcrumb JSON-LD exist. Validate every sitemap URL, redirects, status codes, canonical destinations and structured data with Search Console/Rich Results Test after deployment. Do not add hreflang until stable translated URLs with genuinely translated content and reciprocal tags exist.
15. **WCAG 2.1 AA — PARTIAL SOURCE SUPPORT; CONFORMANCE NOT VERIFIED.** Skip link, visible focus, semantic landmarks, menu states, alt-text quality gate and reduced-motion handling exist. Still perform axe/WAVE plus manual keyboard-only, screen-reader, 200–400% zoom/reflow, contrast, form error, focus order, heading hierarchy, touch-target and video/audio checks. Automated scans alone cannot certify AA.
16. **Analytics cleanliness / bot filtering — PARTLY PRESENT.** Optional GTM loads only after analytics consent, and WhatsApp click events are gated. GA4's known-bot handling is not equivalent to comprehensive spam filtering; no custom server-side bot filtering or internal-traffic exclusion has been verified. Configure GA4 internal traffic/developer filters and review suspicious referrals without blocking legitimate search crawlers.

## Modern technology and development

17. **AI integration — LIVE CATALOGUE GROUNDING ADDED; SAFETY TESTS PENDING.** Concierge reads active experience names and prices from Supabase catalogue and has current fallback prices. Test prompt injection, hallucinated availability, privacy leakage, language quality, escalation to a human, latency, provider failure and cost/rate limits. It must not expose admin data or claim a booking is confirmed without the booking system.
18. **AI scraping / IP protection — ROBOTS PREFERENCES ADDED; INTERNAL DRAFT EXPOSURE FIXED IN SOURCE.** robots.txt now asks named AI training crawlers not to fetch the site, while leaving ordinary search crawlers available. Three internal AI Studio PDFs were removed from the public source directory and the quality gate now blocks their reintroduction. This source fix does not purge an existing production/CDN copy until an approved deployment and cache purge. Robots preferences are voluntary and can be ignored. Actual abuse protection needs provider WAF/bot management, rate limits, origin/API access controls and monitoring. Copyright notices and licence records support rights management but cannot prevent copying.
19. **Green hosting — EVIDENCE REQUIRED.** No verified hosting-provider renewable-energy or net-zero evidence has been supplied. Check the actual hosting and database providers' current sustainability disclosures, region and methodology before making an environmental claim.
20. **CI/CD quality pipeline — BUILD GATES PRESENT; RELEASE PIPELINE NOT FULLY VERIFIED.** GitHub Actions run Astro type-check/build, custom SEO/accessibility/content checks and a high-severity npm audit threshold; the build workflow packages a static artifact. Latest branch runs must pass. The repository currently has no committed npm lockfile, so dependency installs are not fully reproducible. Add and commit a reviewed lockfile, use `npm ci`, pin all third-party Actions to immutable SHAs, and require green checks/review before merge. Deployment remains intentionally deferred.

## Changes completed in this branch

- Optimised homepage hero image dimensions/quality and removed an unused font download.
- Added source-level responsive, keyboard-focus and reduced-motion protections.
- Corrected consent withdrawal and gated analytics conversion events behind opt-in.
- Updated concierge to use active Supabase experience catalogue and aligned fallback prices.
- Added AI-training crawler preferences to robots.txt while retaining ordinary search crawl access.
- Added `/.well-known/security.txt` responsible disclosure contact.
- Removed three internal AI Studio PDF drafts from `public/assets/aistudio/` after a built-artifact inspection found they were publicly shipped; added a regression gate to prevent their reintroduction. This branch fix does not remove files from an already deployed production/CDN copy until a later approved release and cache purge.
- Expanded privacy notice and added copyright / third-party-use / applicable-law sections to website terms.
- Extended automated quality gate for AI crawler directives, security.txt, privacy disclosures, copyright notice and configured security headers.

## Live Supabase findings recorded 1 Nov 2026

- Security advisors reported six RLS-enabled internal tables without direct policies: `ai_conversations`, `ai_messages`, `booking_idempotency`, `guest_chat_rate_limits`, `guest_profiles`, `notification_logs`. Confirm browser roles have no table grants before changing policies; Edge Functions may intentionally use server credentials.
- Advisor flags one anonymous-executable SECURITY DEFINER booking RPC and 16 authenticated-executable SECURITY DEFINER functions. The public booking RPC and admin operations may be intentional; individually inspect function bodies and grants before modifying them.
- Supabase Auth leaked-password protection was disabled at the time of review; enable it in project Auth settings and test sign-in/reset behaviour.
- Performance advisors listed 24 unused indexes; do not remove them without workload evidence.
- No migrations or Edge Function deployments were applied during this branch work.

## Release gates — must be completed before production

- [ ] Latest CI build, type-check, quality gate and dependency audit pass on the final branch SHA.
- [ ] Commit a package lockfile and switch CI to deterministic `npm ci`.
- [ ] Lighthouse mobile/desktop and real-device CWV review.
- [ ] Responsive, cross-browser, WCAG keyboard/screen-reader/contrast tests.
- [ ] Clean-profile cookie tests: no GTM before opt-in; reject remains rejected; accept loads analytics; reopen and withdraw works.
- [ ] Live HTTPS/TLS, redirects, headers, CDN/cache and bot/WAF configuration verified.
- [ ] Sitemap/canonical/schema and Search Console crawl validation.
- [ ] Authorised VAPT, Supabase function/RLS review, Auth leaked-password protection and backup restore drill.
- [ ] Legal review of privacy, terms, intellectual-property permissions and tax/payment model.
- [ ] API outage tests, AI safety tests, uptime/error monitoring, green-hosting evidence and analytics spam/internal traffic review.

**Release state: NOT DEPLOYED. NOT SECURITY-TESTED. NOT LEGALLY CERTIFIED. NOT WCAG-CERTIFIED.**  
The code branch can be build-verified; external infrastructure, legal and human testing gates remain explicit and must not be represented as complete.
