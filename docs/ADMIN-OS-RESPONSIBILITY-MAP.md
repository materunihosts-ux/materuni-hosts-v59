# Materuni Hosts — Dashboard and Business OS Responsibility Map

## Product boundary

Materuni Hosts has two private workspaces with separate responsibilities. They share the same administrator access and public-site data where required, but they must not become duplicate dashboards.

### A. Public Website Dashboard — `/admin`

Purpose: maintain what a visitor can see and read on materunihosts.com.

Owns:
- Website content and brand stories.
- Landing-page copy and page presentation.
- Public experience descriptions, inclusions and displayed prices.
- Authentic photography and media assets.
- Public-facing host facts, visitor information and guest policies.
- Website-wide contact details, links and presentation settings.

Does not own:
- Booking operations and reservation follow-up.
- Guest CRM and sales pipeline.
- Marketing campaigns and content calendars.
- SEO issue triage, keyword research and growth reporting.
- AI business analysis and automation workflows.

### B. Business OS — `/admin/business-os`

Purpose: run the business, manage growth issues and coordinate guest journeys.

Owns:
- Booking and experience operations.
- Guest inbox, enquiry triage and follow-up status tracking.
- Growth engine: technical SEO audits, keyword/content research, SEO metadata tasks and campaign planning.
- AI-assisted analysis and draft preparation.
- Performance reporting.
- Approval policy and, in a later phase, a durable approval queue and controlled action execution.

The SEO metadata editor at `/admin/seo` belongs to the Business OS because it is used to resolve search visibility and marketing issues. It changes public metadata, but the workflow and prioritisation belong to growth operations.

## Navigation model

Business OS navigation is grouped into:
1. Operations — overview, bookings, guest CRM/inbox, experiences and pricing.
2. Growth Engine — Marketing & SEO Studio and SEO Metadata Studio.
3. AI & Control — AI assistant, performance insights and approvals.
4. Website — shortcut to the Public Website Dashboard.

Public Website Dashboard navigation is task-led:
1. Website content and stories.
2. Landing pages.
3. Experiences and published prices.
4. Photography and media.
5. Host details and guest policies.
6. Website settings.

## Capability truth table

| Capability | Current state | Must not be represented as |
|---|---|---|
| Admin authentication | Existing Supabase password login and allowlist checks | A unified SSO session across every legacy admin page |
| Public website content tools | Existing admin routes | A complete visual page builder |
| On-page SEO crawler | Browser-side live public-page checks in Marketing & SEO Studio | Google rankings, keyword volume or backlink monitoring |
| SEO research brief | Guided research template | Verified keyword intelligence |
| Blog draft | Local browser draft and Markdown export | Cloud-saved CMS content or auto-publishing |
| SEO metadata editor | Existing route and Supabase site_settings save path | Guaranteed immediate search ranking improvements |
| Guest inbox | Existing concierge conversation tools and status updates | Full HubSpot-grade CRM pipeline, contact deduplication or automated follow-ups |
| AI command center | Draft interface and server-side provider abstraction | Connected AI until provider keys are configured and tested |
| Approval Center | Approval policy preview | A live approval queue or execution authorization |
| External campaign publishing | Not connected | Automated social publishing |
| Search Console / GA4 sync | Requires verified integration | Live SEO/marketing analytics |
| Durable automation engine | Not implemented | Background workflows running unattended |

## UX principles

- One screen should answer: what is this area for, what can I do next, and what is actually connected?
- Use plain language and task-based labels rather than technical module names.
- Keep frequent actions visible; move advanced or rare controls out of the primary path.
- Mobile navigation must remain reachable and horizontally scrollable, not hide all links.
- Search should filter visible task cards and never imply that it searches business records.
- Show real data only when it comes from a connected source. Use explicit “Setup required” or “Not connected” labels otherwise.
- Never claim that AI, publishing, CRM automation or approvals are active until end-to-end tests prove they work.

## Integration direction

Use the current Astro/Vercel/Supabase architecture as the starting point. Keep the public website and the two workspaces on the existing stack while designing a modular growth/automation layer.

Recommended sequence:
1. Stabilise the two-workspace UX and route boundaries.
2. Audit existing data tables and APIs; define a single guest/lead identity and event model.
3. Connect Google Search Console and GA4 with least-privilege OAuth and visible sync status.
4. Persist campaign plans, content drafts and CRM follow-up tasks in Supabase.
5. Add a durable approval queue with immutable proposal versions and audit events.
6. Add background jobs with retries, idempotency and failure visibility.
7. Add AI provider abstraction only after the data permissions, logging and cost controls are defined.
8. Connect WhatsApp/email/social publishing last, with explicit consent and approval gates.

No production deployment, database migration or external account connection is authorised by this UI redesign alone.
