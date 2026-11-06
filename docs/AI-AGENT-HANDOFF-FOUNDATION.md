# Materuni Intelligence OS — AI Agent Handoff

**Purpose:** Give an independent coding/review agent a safe, evidence-led starting point for stabilising the existing Materuni Hosts repository. This is a handoff brief, not proof that the listed work has passed CI or is production-ready.

## Repository and working boundary

- Repository: https://github.com/materunihosts-ux/materuni-hosts-v59
- Current working branch: `intelligence-os/foundation-audit-2026-11-06`
- Related draft PR: https://github.com/materunihosts-ux/materuni-hosts-v59/pull/48
- Production base: `main`
- Branch comparison at handoff preparation: 113 commits ahead, 0 behind `main`. This is a large accumulated change set; do not assume every commit belongs to one coherent feature.
- Architecture: Astro static site + Tailwind/CSS + Supabase backend/Edge Functions + Vercel hosting. Keep this architecture unless the owner explicitly approves a change.
- Package manager: npm; CI uses Node.js 22.

## Mission

Stabilise first. Do not add more product features until the existing branch has a reliable baseline and the failures have been classified.

The agent should:
1. Independently inspect the full branch diff against `main`, not just the latest commits.
2. Reproduce local install, tests, Astro check, build and quality gate in a clean Node 22 environment.
3. Produce a failure ledger with exact command/workflow, failing file/line, error text, root cause, severity, reproducibility and proposed fix.
4. Separate code defects from unavailable external services, missing secrets, provider quotas, permissions and CI configuration.
5. Fix only confirmed code/configuration defects in focused commits, adding regression tests.
6. Re-run all relevant checks and report exact commit SHA and command outputs.
7. Leave a clear handover report for owner review.

## Required commands

Run from repository root, with Node 22:

```bash
node --version
npm --version
npm install --no-audit --no-fund
npm run test:seo
npm run check
npm run qa
npm run build
```

Note: `npm run build` already runs `npm run check`, `astro build`, and `npm run qa`. Run the individual commands as well when isolating a failure. Do not treat a missing environment variable or external provider outage as a passing integration test.

## Known scripts and tests

- `npm run test:seo` runs:
  - `tests/seo-audit-utils.test.js`
  - `tests/seo-keyword-import.test.js`
  - `tests/seo-intelligence-model.test.js`
  - `tests/google-search-console-api.test.js`
- `npm run build`: check → Astro build → quality gate.
- CI workflow: `.github/workflows/ci.yml`; Astro build workflow: `.github/workflows/astro-build.yml`.
- Package metadata currently declares Astro 7, TypeScript 5.9 and @astrojs/check 0.9.10. Verify the actual lockfile situation; README previously noted that dependency installs were not fully reproducible due to the absence of a committed npm lockfile.

## Main change areas to audit

- `api/google-search-console.js`: server-side GSC OAuth refresh and read-only Search Analytics API.
- `src/pages/admin/google-search-console.astro`: private GSC admin view.
- `src/lib/seo-audit-utils.js`: crawl/snapshot utilities.
- `src/lib/seo-intelligence-model.js`: heuristic SEO checks.
- `src/lib/seo-keyword-import.js`: CSV parsing and provenance.
- `src/pages/admin/marketing.astro`, `src/pages/admin/seo-keywords.astro`: admin UI changes.
- `scripts/site-quality-gate.mjs`: custom build gate.
- `tests/`: regression tests for the above.

Read the related docs before changing behavior:
- `docs/MATERUNI-INTELLIGENCE-OS-REPOSITORY-AUDIT.md`
- `docs/MATERUNI-INTELLIGENCE-OS-DATABASE-BASELINE.md`
- `docs/DATABASE-SECURITY-REGRESSION-TEST-MATRIX.md`
- `docs/EXPANDED-SUPABASE-FUNCTION-REVIEW-2026-11-06.md`
- `docs/SUPABASE-SECURITY-REVIEW-2026-11-06.md`
- `docs/GOOGLE-SEARCH-CONSOLE-CONNECTOR.md`
- `docs/SEO-INTELLIGENCE-MODEL.md`
- `docs/SEO-SNAPSHOT-DATA-CONTRACT.md`

## Confirmed boundaries and outstanding dependencies

- Supabase project quota previously blocked project requests and image delivery. Treat this as an external service/quota issue unless logs prove a code defect. Do not create another Supabase project or alter billing.
- Vercel previously rejected preview deployment due to its daily deployment quota. Do not repeatedly retry or upgrade. A Vercel deployment limit is not an Astro build failure.
- GSC code exists but live connection is not verified. It requires Google OAuth client ID, client secret, refresh token, and exact Search Console property configured as server-only Vercel Preview environment variables. Never request secrets in chat or commit them.
- GSC has no in-app OAuth callback/token vault; the refresh token is manually configured server-side.
- GA4 Data API integration has not started. Do not represent GA4 as integrated.
- No fresh CI pass was confirmed for the latest GSC security/date-validation commits at the time this document was prepared.
- No new preview, production deployment, merge or database migration is authorised by this brief.

## Non-negotiable safety rules

- Do not merge PR #48 or deploy production.
- Do not modify production Supabase schema/data, run migrations, truncate/delete records, reset a project, rotate credentials or change billing.
- Do not introduce new paid services, subscriptions or API usage without owner approval.
- Do not place service-role keys, OAuth secrets, refresh tokens, guest data or private tokens in client code, logs, test fixtures or commits.
- Do not fabricate test results, ranking claims, live integration status, or preview URLs.
- Preserve booking, availability, admin authorization, payment, multilingual and guest-concierge behavior unless a reproducible defect requires a narrowly scoped fix.
- Keep changes on the existing feature branch or a clearly named child branch; never force-push or rewrite shared history.
- If a required external dependency is unavailable, document the blocker and continue with offline/local validation.

## Required final report format

1. Exact branch and HEAD SHA.
2. Environment (OS, Node, npm).
3. Commands run and PASS/FAIL/BLOCKED for each.
4. Failure ledger with root cause and evidence.
5. Files changed and why.
6. Tests added and regression coverage.
7. Remaining external dependencies / manual steps.
8. Explicit confirmation: no production deployment, merge, destructive data change or paid change was performed.
9. Recommendation: ready for human review / not ready, with reasons.
