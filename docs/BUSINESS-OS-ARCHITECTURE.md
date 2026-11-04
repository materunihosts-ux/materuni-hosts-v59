# Materuni Hosts Business OS — Architecture & Phase 0 Audit

Status: architecture baseline / read-only audit. No production code, database schema, secrets, or deployment has been changed.

## Product decisions
- Product: Materuni Hosts Business OS.
- Initial rollout: private pilot for Materuni Hosts.
- AI strategy: multi-provider (OpenAI, Anthropic, Google Gemini behind a provider adapter).
- Future direction: multi-organization / agency-capable architecture.
- User experience: one dashboard and one login; public website remains independently optimized.

## Existing platform discovered
- Repository: materunihosts-ux/materuni-hosts-v59
- Default branch: main
- Current framework: Astro 7, TypeScript, static output.
- Hosting target documented by repository: Vercel; Netlify is testing-only.
- Existing Supabase project: sskmzswoeljxwojcszta (eu-central-1), PostgreSQL 17.
- Existing Supabase resources include booking, availability, CMS, admin, CRM/guest concierge, notifications, invoicing/quotations, and SEO tables.
- Existing Edge Functions documented: booking-notifications, guest-concierge, admin-communications.
- Existing package scripts: npm run check, npm run build, npm run preview. Build includes Astro checks and a site-quality gate.

## Architecture decision
Use a modular application architecture with background workers, not a rewrite of the public site.

1. Public web: keep Astro static rendering and existing routes.
2. Admin/Business OS: add isolated, authenticated dashboard modules under the existing admin experience. Choose the smallest compatible interactive layer after inspecting current admin routes and dependencies.
3. Backend: retain the existing Supabase project and existing booking/CMS data. Introduce new OS tables only after schema/policy design and a reviewed migration.
4. AI gateway: provider-neutral server-side adapter for OpenAI, Anthropic and Gemini; model routing by task, budget, latency and capability.
5. Automation: durable job execution with retries, idempotency, scheduling and human approvals. n8n may be used as an orchestration integration, not as the source of truth.
6. Integrations: official OAuth/API adapters; credentials encrypted and server-side only.
7. Multi-business readiness: organization_id/workspace_id scoping, membership roles and tenant-aware RLS. Pilot begins with one organization; do not expose multi-tenant signup in phase 1.

## Proposed dashboard modules
- Overview
- Bookings & availability
- Website/CMS
- Customers & CRM
- AI Command Center
- SEO Intelligence
- Social Media & content calendar
- Creative Studio
- Advertising
- Email & WhatsApp communications
- Analytics & reports
- Automation center
- Integrations, approvals, settings and audit history

## AI execution policy
- Automatic: read-only audits, monitoring, reports, draft generation.
- Approval required: publish content, send bulk messages/campaigns, change public website content.
- Restricted: spend money, change advertising budgets, delete records/campaigns, modify booking state or execute destructive actions.
- Every agent run records organization, actor, provider/model, input/output references, cost/usage, tool calls, approval state and outcome.
- Never allow the model to choose arbitrary SQL or bypass application authorization.

## Phase 0 repository findings
- README confirms the public site is static Astro output and warns that some existing scripts still embed the public Supabase URL and publishable key as constants; .env.example alone does not override them.
- The public Supabase key is not a secret, but all browser-exposed tables/RPCs must have least-privilege grants and RLS.
- README documents booking, availability, admin, CMS, guest concierge and image storage resources.
- Existing README says latest Edge Function hardening source has not yet been deployed to live functions. Verify each function's deployed version and logs before touching it.
- Homepage source contains curated experience fallback data and prices. Keep the approved catalogue in Supabase as the operational source of truth; audit consistency before changing prices/content.
- Existing repository package does not yet show a multi-provider AI SDK dependency. Add only after a scoped feature is ready and pin package versions with lockfile changes.

## Supabase read-only audit snapshot (2026-11-04)
- Project status: ACTIVE_HEALTHY; PostgreSQL 17.11; region eu-central-1.
- 34 public tables were returned by the catalog audit; all had RLS enabled.
- Important existing table groups include bookings, availability_slots, experience_catalog, site_content/site_settings, guest_profiles, notification_logs, communication_logs, quotations/invoices/payments, and SEO tables.
- Security advisor reported six RLS-enabled tables without policies: ai_conversations, ai_messages, booking_idempotency, guest_chat_rate_limits, guest_profiles, notification_logs. Confirm intended access paths before adding policies; some may be accessed only through tightly controlled server-side functions.
- Security advisor also reported one anon-executable SECURITY DEFINER RPC (submit_booking_idempotent) and 16 authenticated-executable SECURITY DEFINER functions. These are not automatically vulnerabilities, but each function's authorization checks, search_path, grants and exposure must be reviewed individually.
- Leaked-password protection is disabled in Supabase Auth.
- Performance advisor reported unused indexes (not an instruction to delete them) and multiple permissive SELECT policies on guest_reviews.
- No SQL DDL, RLS, grants, functions, production rows or secrets were changed during this audit.

## Critical design constraints
- Do not replace the existing Supabase project or bookings table.
- Do not reset/truncate/delete production data.
- Do not change production DNS or deploy to production as part of the pilot foundation.
- Do not expose service-role keys, AI keys, OAuth tokens or WhatsApp tokens to browser code.
- Every new exposed table needs RLS and explicit grants appropriate to the access model. Supabase now defaults new public tables to not being exposed through the Data API; enable exposure only deliberately.
- Do not assume platform APIs allow all publishing/messaging actions. Check scopes, approvals and provider terms.
- Preserve current website SEO, performance, branding and booking flow.

## Recommended implementation phases
1. Complete repository and deployed-function inventory; identify current admin routes and environment-variable usage.
2. Build a preview-only Business OS shell in an isolated branch; no database changes.
3. Design organization/workspace membership and RLS model; review SQL before applying any migration.
4. Add approval/audit/job infrastructure.
5. Add provider-neutral AI gateway and first safe agent (SEO read-only analysis).
6. Connect Search Console and GA4; show reports and draft recommendations.
7. Add content calendar and social adapters with approval gates.
8. Add CRM/communications and advertising integrations after credentials and API eligibility are verified.
9. Pilot QA, accessibility, performance, security and rollback review.

## Acceptance gates
Each phase must have:
- a preview deployment or locally reproducible preview;
- successful npm run check and npm run build;
- desktop and mobile QA;
- functional and security tests appropriate to the change;
- explicit owner approval before production deployment.

## Next audit tasks
- Inventory all admin page routes, scripts and client-side Supabase initialization.
- Inspect supabase/functions source and deployed status.
- Read migration history and storage policies.
- Confirm current Vercel project linkage and preview environment configuration.
- Build a route/module map before adding any dashboard navigation.

## Additional source review — pricing consistency
- The current guest-concierge Edge Function source contains fallback and system-prompt experience names/prices that do not match the current approved Materuni Hosts catalogue documented in project context and the homepage fallback (for example, it still contains legacy $65/$75/$85/$110/$135 prices).
- Treat this as a high-priority content correctness issue before enabling AI-generated concierge responses or marketing automation. Do not deploy a fix blindly: first inspect the live experience_catalog rows and confirm the approved current price list, then make the concierge read from one server-side source of truth rather than hard-coded duplicate price lists.
- This is a source-code finding only; no Edge Function was deployed or changed.
