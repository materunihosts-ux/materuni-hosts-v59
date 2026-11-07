# Materuni Intelligence OS — Repository Audit & Foundation Plan

Audit date: 2026-11-06  
Repository: `materunihosts-ux/materuni-hosts-v59`  
Base branch reviewed: `main`  
Working branch: `intelligence-os/foundation-audit-2026-11-06`  
Audit type: read-only source inspection; no production, database, deployment, or credential changes.

## Executive summary

The repository already contains a useful Astro + TypeScript + Supabase + Vercel foundation. It is not yet a complete autonomous marketing operating system. The strongest existing pieces are the public-site SEO quality gate, a browser-driven on-page crawler, a keyword library backed by a Supabase table, SEO metadata editing, and a server-side AI provider adapter.

The principal gap is not the absence of an admin interface. It is the absence of a verified, end-to-end intelligence pipeline: trusted source data → normalized records → analysis → recommendations → human approval → controlled execution → measurement.

Do not replace the current stack or rebuild the whole repository. Extend it incrementally and preserve the booking, catalogue, public website, and existing admin authorization model.

## Scope and evidence

Reviewed repository metadata, recent commits, the repository tree, and selected source files:

- `package.json`, `astro.config.mjs`, `vercel.json`
- `src/pages/admin/marketing.astro`
- `src/pages/admin/seo.astro`
- `src/pages/admin/seo-keywords.astro`
- `src/pages/admin/business-os.astro`
- `src/pages/admin/ai.astro`
- `src/pages/admin/analytics.astro`
- `src/pages/admin/approvals.astro`
- `api/business-os-ai.js`
- `docs/BUSINESS-OS-ARCHITECTURE.md`
- `docs/ADMIN-OS-RESPONSIBILITY-MAP.md`
- `docs/BUSINESS-OS-AI-COMMAND-CENTER.md`
- `docs/BUSINESS-OS-CORE-DATA-MODEL.md`
- `docs/BUSINESS-OS-SUPABASE-SECURITY-REVIEW.md`
- `scripts/site-quality-gate.mjs`
- `supabase/functions/guest-concierge/index.ts`
- `src/lib/supabase-public.ts`

This is a source review, not a successful local build, automated test run, live OAuth verification, or production penetration test. Findings below distinguish code observed from integrations that remain unverified.

## Existing foundation

### Stack and build

- Astro static output with Vercel deployment configuration.
- TypeScript and Astro checks are part of the build script.
- Build sequence is `npm run check && astro build && npm run qa`.
- A custom site quality gate checks built routes, sitemap/robots, metadata-related content, selected accessibility/contrast requirements, catalogue references, and other project-specific invariants.
- Supabase is used for authentication, database, storage, RPCs, and Edge Functions.

### SEO and marketing

| Capability | Observed implementation | Assessment |
|---|---|---|
| Metadata editor | Admin UI reads/writes SEO metadata in `site_settings`; includes title, description, OG image, canonical and robots fields | Exists; verify public-page rendering and publishing semantics end-to-end |
| On-page crawler | Browser fetches sitemap/core public routes and parses title, description, H1, canonical and image alt attributes | Basic crawler exists; limited checks and depends on browser-accessible pages |
| Keyword library | Reads/writes `seo_keywords` via Supabase REST; supports CSV import and keyword records | Working code path exists; data quality, RLS and real ranking sync need tests |
| Research brief | Produces structured topic/audience/intent guidance in the browser | Planning aid, not measured keyword research |
| Content editor | Drafts are stored in browser localStorage and can be exported | Local-device draft only; no shared draft store or publishing pipeline |
| Search Console | UI explicitly says connection required | Not verified/implemented as a live integration |
| GA4 | UI/docs indicate connection required | Not verified/implemented as a live integration |
| Competitor/SERP data | No live provider adapter verified in reviewed files | Missing as a verified capability |
| Backlink intelligence | No live backlink source/adapter verified in reviewed files | Missing as a verified capability |
| AI search visibility | No measurement integration verified | Missing as a verified capability |

### AI and governance

- `api/business-os-ai.js` provides server-side routing to OpenAI, Anthropic, and Gemini.
- Provider keys are read from server environment variables; the browser calls the server endpoint with an administrator session.
- Outputs are explicitly draft-only; the endpoint does not publish or perform external actions.
- Current request throttling is an in-memory per-instance Map (8 requests per 10 minutes per user). It is best-effort, not durable, and not shared across serverless instances.
- AI run history, durable usage ledger, job queue, approval records, and execution audit trail are documented as not implemented.
- `/admin/approvals` is a policy preview, not a connected approval queue.
- `/admin/analytics` includes internal booking/enquiry analytics; it is not a replacement for Search Console or GA4 acquisition analytics.

### Security and operations

- Existing security review documents six RLS-enabled tables without policies and a set of SECURITY DEFINER functions needing function-by-function review. Some may intentionally be server-only; do not add broad policies or revoke grants indiscriminately.
- Supabase leaked-password protection was reported disabled in the prior security review; current setting must be rechecked in Supabase.
- Public Supabase URL and publishable key are intentionally public credentials, not service-role secrets. The browser helper contains fallback values; future environments should be configured explicitly and server secrets must never enter browser code.
- The Guest Concierge uses a service-role key server-side and has input bounds and rate limiting; review CORS, proxy IP trust, and abuse resistance before expanding usage.
- Recent commits on 2026-11-06 show work to reduce unnecessary admin reads and bound availability reads. Preserve and regression-test those improvements.

## Main gaps and risks

1. **No single source-of-truth intelligence pipeline.** Keyword records, browser crawler output, analytics and AI drafts are not yet connected through a common data model.
2. **No verified first-party search performance integration.** Search Console and GA4 are not shown as connected live sources in the reviewed UI.
3. **Research is not equivalent to market data.** The current brief must not be represented as search volume, difficulty, rank tracking or competitor intelligence.
4. **No durable background execution.** Scheduled crawls, sync jobs, retries, deduplication and job failure visibility are not verified.
5. **No persisted content workflow.** The current blog draft is localStorage-only; drafts are not shared between devices/admins and are not publishable through a controlled pipeline.
6. **Governance is a design preview.** Approval policy is described but not backed by durable records and execution-time authorization.
7. **Rate limiting and cost accounting are incomplete.** Per-instance memory limits do not provide durable quotas or spend reporting.
8. **Multi-business readiness is design-level only.** Workspace concepts appear in proposed docs, but a complete workspace-scoped data and authorization model has not been implemented.
9. **SEO metadata publishing requires an end-to-end test.** Saving a database setting is not proof that a statically generated public page's HTML metadata changes for search crawlers.
10. **No current test evidence.** This audit did not run `npm ci`, `npm run check`, `npm run build`, RLS tests, or production smoke tests.

## Priority foundation plan

### Phase 0 — protect the existing product (first)

- Keep all work on this feature branch until reviewed.
- Capture the current build/test baseline and list existing failing checks before changing behavior.
- Map existing tables, RLS policies, RPCs, Edge Functions, admin auth checks, and public/admin route boundaries.
- Do not alter bookings, prices, catalogue, guest records, production environment variables, DNS, or production deployment.
- Keep AI and external integrations in draft/read-only mode.

### Phase 1 — data and security foundation

- Define a minimal, workspace-aware intelligence data contract while retaining `admin_users` as the current authorization source during the pilot.
- Review the existing `seo_keywords` table schema and RLS before extending it.
- Add no duplicate tables until existing schema inventory is complete.
- Establish typed server-side adapters for source data; browser code must not hold provider secrets.
- Define redaction, retention, idempotency, request budgets and audit-event conventions.

### Phase 2 — first reliable SEO intelligence loop

1. Technical crawl snapshot: store timestamped results and per-URL findings.
2. Search Console import/sync: read-only OAuth/API, limited scopes, visible connection state.
3. Keyword opportunity model: distinguish manually entered terms, GSC query observations, and third-party estimates.
4. Recommendation engine: every recommendation references source evidence, confidence, affected URL and proposed action.
5. Content workspace: shared saved drafts with versions; no auto-publishing.
6. Measurement: compare impressions, clicks, CTR and average position before/after approved changes.

### Phase 3 — agents and controlled automation

- Introduce separate agents only after source data and task contracts are reliable.
- Use durable jobs with bounded retries, idempotency keys, dead-letter visibility and usage budgets.
- Persist AI runs, redacted input summaries, output references, model/provider identifiers, cost/usage metadata and errors.
- Approval must bind to an immutable payload/version; any changed payload requires a new approval.
- Require explicit approval for publishing, guest messaging, price changes, booking mutations, ads spend, destructive actions and external disclosure.
- Keep execution adapters disabled until authorization and end-to-end tests pass.

### Phase 4 — competitive capabilities

- Competitor/SERP monitoring through a lawful, documented data provider.
- Backlink opportunity and monitoring integration through a suitable provider.
- AI answer/visibility tracking with repeatable prompts, dates, locations and source capture.
- Scheduled reporting and recommendations tied to measurable business outcomes.

## Recommended first implementation slice

Do not start by building six autonomous agents. The highest-value, lowest-risk foundation is:

**SEO Data Foundation v1**
- inventory and validate the current `seo_keywords` schema/RLS;
- introduce a typed, source-labelled SEO observation model only if no existing table can safely support it;
- persist on-page crawl snapshots and URL findings;
- make the UI label each value as live, imported, manually entered, estimated, or unavailable;
- add no GSC OAuth until callback, token storage, refresh, revocation, scopes and privacy controls are designed;
- do not add paid keyword/backlink APIs at this stage.

Acceptance criteria:
- no change to public pages, booking behavior, prices or production data;
- admin-only access is verified for every read/write path;
- crawler results are persisted and reproducible;
- source and timestamp are visible for every metric;
- duplicate runs do not create duplicate observations;
- failures are visible and retry-safe;
- build, type checks, and relevant RLS tests pass in preview.

## Explicit non-goals for this phase

- No framework migration.
- No production deployment.
- No production database migration.
- No paid subscriptions or new third-party API spend.
- No autonomous publishing, guest messaging, ads changes or booking mutations.
- No claim that the repository currently matches Visibly AI or Outrank feature-for-feature.

## Audit conclusion

Materuni Hosts has a meaningful product foundation, but its current SEO/Marketing workspace is a collection of useful early tools rather than a connected intelligence operating system. Build the data, security, provenance, persistence and measurement foundation first. Then add agents and automation on top of verified evidence.


## 2026-11-06 — First code-only foundation change

The Marketing & SEO Studio's browser-side on-page crawler was strengthened on the feature branch:

- Enforces same-origin URL inspection and rejects non-HTML responses.
- Applies a 12-second per-page request timeout.
- Records HTTP status, robots directive, mobile viewport presence and Open Graph title presence.
- Flags noindex pages, missing viewport, missing Open Graph title and off-site canonical URLs in addition to the existing title/description/H1/image-alt checks.
- Includes the additional observations in the visible audit table and CSV export.
- Reports the crawl source and explicitly states that this is not Google ranking, traffic or backlink data.

This remains a live crawl performed in the administrator's browser. It is **not yet a persisted, repeatable database snapshot**. No database schema, public route, booking flow, price, production deployment or secret was changed. Runtime/build tests have not yet been run in this environment; the change has been verified by re-fetching the committed source and checking that all intended code paths are present.


## 2026-11-06 — SEO crawler safety and regression coverage

A second code-only batch extracted the crawler's URL and CSV handling into the dependency-free module `src/lib/seo-audit-utils.js` and added a focused Node test suite:

- Sitemap entries must be absolute HTTP(S) URLs on the current site; malformed, relative and off-site entries are ignored.
- Sitemap crawling is bounded to 150 URLs by default (hard cap 1,000), de-duplicates paths and safely falls back to the core-page list if the sitemap has no valid same-origin URLs.
- The crawler checks the final response URL after redirects, so a same-origin URL that redirects off-site is rejected.
- CSV fields are quoted and escaped; formula-like values beginning with spreadsheet control characters are prefixed to prevent formula execution when opened in spreadsheet software.
- Added `npm run test:seo` and four regression tests for same-origin validation, sitemap filtering/deduplication, URL limits and CSV formula injection.

Validation: the four utility test cases were executed with Node's built-in test runner in an isolated temporary test fixture and passed (4/4). The repository's full `npm run check`, `npm run build` and `npm run qa` have **not** been executed because the repository has not been checked out in a local build environment in this session. No database migration or production deployment was performed.


### Portable audit snapshot export

The crawler now also exports a versioned JSON snapshot (schema version 1) alongside CSV. The JSON includes the actual crawl scope used (including fallback to core pages when the sitemap is unavailable/invalid), normalized site origin, capture timestamp, source label, page observations and derived page/issue counts. This is a portable local export, not database persistence: it is not uploaded, synced or retained centrally. The snapshot helper rejects invalid/non-HTTP(S) origins and unsupported scope values.

The regression suite now contains six cases. The exact utility behavior was exercised in a temporary Node.js test fixture: **6 passed, 0 failed**. A first test attempt exposed an incorrect assertion pattern in the CSV test (the CSV correctly quoted the apostrophe-prefixed +cmd cell); the assertion was corrected and the six-case suite passed. A GitHub checkout/full Astro build could not be run because outbound GitHub network access was unavailable in the local execution container. The repository test command is committed as npm run test:seo; it still needs to be run against a fresh checkout before merge.


## 2026-11-06 — Local snapshot comparison

The feature branch now includes a browser-only comparison workflow for exported SEO snapshots:

- Import a previously exported JSON snapshot (maximum 2 MB in the admin UI).
- Compare it with a newly completed crawl from the same site origin and same crawl scope.
- Identify added, removed, changed and unchanged URLs.
- Show changed page observations and newly observed/resolved crawler findings.
- Validate schema version, provenance, origin, path shape and duplicate paths before comparing.
- Render imported content as text; imported files are not uploaded to a server.

A scope mismatch is rejected so a sitemap crawl is not misleadingly compared with a core-page crawl. The comparison utility and UI regression cases have been added to the Node test suite. The suite now contains ten test cases, but **the expanded ten-case suite has not yet been executed** in this environment. The earlier six-case utility suite passed in an isolated temporary fixture; that result does not validate these newly added comparison cases or the Astro page.

A small UI state issue was also corrected: the crawl scope is now retained outside the audit event handler so JSON export and comparison can access the actual scope, and the compare action becomes available when both a baseline and a new crawl exist.

Limitations remain explicit: snapshots are still files kept by the administrator, not shared database history. No Supabase schema or data was changed. No production deployment or Vercel preview has been created, and the complete Astro check/build/quality gate remains unverified.


## 2026-11-06 — Keyword import provenance and validation

The SEO Keyword Studio now classifies CSV files by header shape as a keyword list, keyword-metrics export, or Search Console-shaped performance export. It does not claim the file is authentic or that a Search Console API connection exists.

The import utility validates keyword length, numeric ranges, supported intent values and same-origin target URLs; rejects credential-bearing/off-site target URLs; skips blank and duplicate keywords; and records a controlled user-supplied/unverified provenance note in the existing notes field. The UI now shows the broad record source and explains that imported data is not independently verified. The existing schema and authenticated Data API write path are retained; no table, policy, grant, or production record was changed.

The import now reports partial completion accurately if a later batch fails, and distinguishes a successful insert from a subsequent list-refresh failure. The test script includes five keyword-import cases alongside the existing crawler/snapshot suite.

Validation performed: the five keyword-import cases passed (5/5) in an isolated temporary Node fixture containing a copy of the helper and tests. GitHub checkout is still unavailable from the local container due DNS/network resolution, so this is not a test run against the exact repository checkout. The complete npm run test:seo, Astro check, production build and quality gate remain unverified.
