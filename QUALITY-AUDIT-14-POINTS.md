# Materuni Hosts — 14-point technical quality audit

Branch: `quality/14-point-hardening`
Base branch: `main`
Deployment: deliberately deferred.

## Status and findings

1. **Page speed / Core Web Vitals — Partially present.** Astro image optimization exists for the homepage hero. Removed the Cormorant webfont download, retained Manrope and a system serif fallback, and added responsive media defaults. Still requires real mobile/desktop Lighthouse and field-data review of LCP, INP and CLS. A universal two-second guarantee is not a valid CWV promise.
2. **Mobile-first responsiveness — Partially present.** Existing 850px/560px breakpoints cover the main shell. Added media overflow protection. Every route, admin table, booking form and dialog still needs testing at 320, 360, 390, 768, 1024 and 1440px.
3. **Navigation / three-click discoverability — Partially present.** Shared navigation, a labelled landmark, menu expanded state, Escape handling and focus return exist. Still test real visitor tasks: find experience, inclusions, price, location, availability, terms and contact.
4. **SSL / HTTPS — External verification required.** Canonical URLs use HTTPS. Verify certificate chain, renewal, HTTP redirect, HSTS, mixed content and TLS on the actual domain; source code cannot certify this.
5. **GDPR / CCPA / cookie consent — Partially present.** Existing consent separates accept/reject and optional analytics; GTM loads only after analytics opt-in. Fixed hidden UI display behavior and preference synchronization. Legal review is still required for controller identity, lawful basis, retention, data-subject requests, processors, international transfers, CCPA applicability and consent records. Do not claim certification.
6. **Technical SEO / schema — Partially present.** robots.txt, sitemap, canonical metadata and JSON-LD exist. Removed hreflang query alternates that were not stable translated landing pages and removed the robots rule blocking lang query variants, allowing canonicalization to be observed. Add reciprocal hreflang only after stable localized URLs and translated metadata/content exist. Validate every sitemap URL and schema externally.
7. **WCAG 2.1 AA — Partially present.** Added visible keyboard focus, skip-link focus styling, responsive media defaults and reduced-motion support. Manual keyboard, screen-reader, zoom/reflow, contrast, form-error, heading-order and touch-target testing is still required. Automated tests cannot certify WCAG.
8. **Cross-browser — External verification required.** Test Chrome, Safari/iOS, Firefox, Edge and Android Chrome, including navigation, language selector, forms, storage, media and booking.
9. **Global CDN / edge caching — External verification required.** No Cloudflare or global CDN configuration is certified by this source audit. Verify DNS/proxy, cache rules, immutable static assets, HTML cache policy, Brotli, image delivery, purge and origin protection with the real provider. Do not cache private/admin/booking responses publicly.
10. **International tax / card fraud — Not implemented and not currently evidenced as needed.** Current booking terms say card payment is not available on the website; the flow is a booking enquiry. Do not invent VAT rules or claim compliance. Before online payments, confirm Tanzania and destination-market tax obligations, provider/merchant-of-record coverage, currency display, receipts, refunds, 3-D Secure/SCA where applicable, PCI scope and fraud/chargeback controls.
11. **Error tracking / uptime — Partially present.** CI build checks exist, but they are not production uptime or error monitoring. Configure monitoring and alerts with privacy-safe filtering, recipients, escalation, retention and service targets. Never send booking PII or payment details to telemetry.
12. **AI integration quality — Partially present.** Guest-concierge infrastructure exists, but model quality, prompt-injection resistance, grounded prices/availability, escalation, multilingual accuracy, latency, cost limits and data handling were not verified. Build an evaluation set; prevent AI from inventing availability or exposing admin/database information.
13. **Green hosting — External verification required.** Hosting energy mix and data-centre sustainability cannot be inferred from Astro source. Verify provider disclosures before publishing environmental claims.
14. **AI scraping / intellectual property — Partially present.** robots.txt expresses crawler preferences; it is not access control and cannot prevent scraping. Use provider WAF/rate limits for abuse, protect admin/API with authorization, and retain original image/font licence records. Do not block normal search crawlers or claim robots.txt protects copyright.

## Required verification before production

- [ ] `npm install` succeeds using the committed lockfile.
- [ ] `npm run check` passes.
- [ ] `npm run build` passes, including the quality gate.
- [ ] Lighthouse mobile/desktop reports are saved; review field CWV when available.
- [ ] Responsive, keyboard, screen-reader and cross-browser tests pass.
- [ ] Consent test in a clean profile: no GTM before consent; reject stays rejected; accept loads analytics; settings reopen and can be changed.
- [ ] Sitemap URLs resolve to intended canonical pages; no private/test pages are indexed.
- [ ] HTTPS, redirects, security headers, CDN/cache, uptime and error alerts are verified against the live domain.
- [ ] Booking, admin and AI flows pass end-to-end tests using test data; no personal data appears in telemetry.

**Release state: NOT DEPLOYED and NOT CERTIFIED.** This branch contains source-level remediations and requires all verification gates above.