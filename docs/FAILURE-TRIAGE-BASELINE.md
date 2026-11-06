# Materuni Intelligence OS — Failure Triage Baseline

**Baseline date:** 2026-11-06  
**Status:** Initial evidence inventory. This document does not claim a fresh CI run or a successful local build.

## Why the dashboard may show many failures

A red status can represent different classes of failure. They must not be mixed:

| Class | Meaning | Correct response |
|---|---|---|
| Code/build defect | Syntax, type, import, bundling or build error | Reproduce locally and fix source |
| Regression test failure | A test assertion or setup fails | Identify regression and add/fix test |
| CI/workflow issue | Workflow trigger, runner, permissions or dependency setup issue | Inspect workflow logs/config |
| Missing configuration | Required environment variable/OAuth property is absent | Mark BLOCKED/configuration, not code failure |
| Provider outage/quota | Supabase/Vercel/Google refuses service due to quota/outage | Record external blocker; avoid repeated retries |
| Access/permission | GitHub, Google, Supabase or Vercel identity lacks permission | Request owner action; do not bypass |
| Manual QA gap | Browser/device/live integration has not been tested | Mark NOT VERIFIED, not PASS |

## Evidence available at baseline

1. The feature branch `intelligence-os/foundation-audit-2026-11-06` compares as **113 commits ahead and 0 behind** `main`. The change set is large and includes multiple areas beyond the newest GSC connector. Audit the complete diff.
2. CI workflow `.github/workflows/ci.yml` runs on pull requests targeting `main`, uses Node 22, installs with `npm install --no-audit --no-fund`, runs `npm run test:seo`, then `npm run build`.
3. `npm run test:seo` includes four Node test files, including mocked GSC API tests.
4. `npm run build` runs Astro check, Astro build and the custom site quality gate.
5. A previous CI run passed on an earlier SHA (`8435576ba94842b1bbfab1477c4731f646e395e4`), but that result is stale and does not verify the latest commits.
6. Latest GSC connector changes include date validation before Supabase calls and frontend date-range validation. Fresh CI verification for those latest changes was not confirmed.
7. Supabase project `sskmzswoeljxwojcszta` previously returned quota-related 402 responses. This can block live Supabase-backed behavior but does not, by itself, prove local Astro build failure.
8. Vercel previously returned a daily deployment quota error (402, retry window approximately 24 hours). This blocks a fresh preview but is not proof that the app build is broken.
9. GSC live access is unconfigured/unverified until server-only OAuth credentials and the exact Search Console property are configured in Vercel Preview.
10. GA4 Data API integration has not started.

## Immediate diagnostic sequence

1. Capture branch HEAD SHA and compare it to `main`.
2. Inspect GitHub Actions runs for the exact HEAD SHA. Do not cite old green runs as proof for a new SHA.
3. Reproduce the CI commands under Node 22 from a clean checkout.
4. Record the first failure in each command, fix it, then rerun the complete sequence.
5. Check the Astro build independently of external service availability. Search for build-time Supabase/Storage requests and ensure static build does not require live user data.
6. Check test isolation, mocked fetch restoration, environment leakage and deterministic fixtures.
7. Audit security-sensitive paths: admin allowlist checks, bearer-token verification, same-origin behavior, secret handling, rate limiting and error leakage.
8. Only after build and tests are green, request a fresh Preview when the Vercel quota allows it.
9. Perform real GSC verification only after the owner configures OAuth and the property. Keep GA4 out of scope until GSC and the baseline are stable.

## Required failure ledger

For every red check, record:

| Field | Required evidence |
|---|---|
| Check name | Exact GitHub check/workflow or local command |
| Commit SHA | Exact SHA tested |
| Result | FAIL / BLOCKED / NOT RUN / PASS |
| Error | First meaningful error and relevant log excerpt |
| Category | Code / test / CI / config / provider / permission / manual QA |
| Root cause | Confirmed cause, or explicitly “unknown” |
| Reproduction | Exact steps and whether repeatable |
| Fix | Smallest safe correction |
| Regression test | Test that prevents recurrence |
| Verification | Exact rerun and resulting SHA/status |

Do not count warning messages, skipped checks, missing external secrets or unavailable provider services as code failures without evidence. Do not mark a blocked or untested item as passed.

## Release gate

The feature branch is not ready to merge or deploy until:
- The full test suite passes on the current HEAD.
- Astro check, build and quality gate pass on the current HEAD.
- CI checks are green for the current PR head.
- Security review of the GSC connector and affected admin routes is complete.
- Preview visual/functional checks are completed when preview deployment becomes available.
- Owner approves any external configuration or release action.

Production deployment, merge, Supabase migrations/data changes, billing changes and secret rotation remain outside this work scope.
