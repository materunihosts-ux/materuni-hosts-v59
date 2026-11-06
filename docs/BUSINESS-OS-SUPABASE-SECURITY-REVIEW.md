# Business OS — Supabase Security Review (2026-11-04)

## Scope and safety boundary

Read-only review of the live Supabase project `sskmzswoeljxwojcszta` and the Business OS foundation branch. No SQL mutations, migrations, Edge Function deployments, production website changes, or credential changes were performed.

## Findings from Supabase Security Advisor

### 1. RLS enabled tables with no policies (6)

- `ai_conversations`
- `ai_messages`
- `booking_idempotency`
- `guest_chat_rate_limits`
- `guest_profiles`
- `notification_logs`

These tables may be intentionally server-only. Do not add broad authenticated policies just to silence the advisor. Confirm which access path each table uses (Edge Function/service role, SECURITY DEFINER RPC, or direct browser client), then either keep them inaccessible to browser roles or add narrowly scoped policies only where required.

### 2. SECURITY DEFINER functions executable by API roles

The advisor reported one function executable by `anon` and 16 executable by `authenticated`.

Read-only inspection confirmed the following examples contain explicit `admin_users` / `auth.uid()` authorization checks in the function body:

- `admin_cancel_booking`
- `admin_confirm_booking`
- `admin_create_availability_slot`
- `admin_delete_booking`
- `admin_get_analytics`
- `admin_get_bookings`
- `is_materuni_admin`

The public `submit_booking_idempotent` RPC is intentionally callable by `anon` for public booking submission. It delegates to `submit_booking`, uses an idempotency key and request hash, and must remain public only if this is the intended public booking API. Its input validation, rate limiting, and abuse controls should be reviewed before changing grants.

**Important:** the remaining SECURITY DEFINER functions were not all inspected individually in this pass. The advisor warning is not proof that every function is exploitable; authorization checks and intended callers must be reviewed function-by-function. Do not revoke all grants in bulk: this could break existing admin screens or public booking.

### 3. Leaked-password protection

Supabase Auth leaked-password protection is disabled. Enable it in Auth password/security settings after confirming the operational impact. This is an Auth configuration change, not a website code change.

### 4. Performance advisor

The advisor listed 25 unused indexes and one duplicate/permissive-policy warning on `guest_reviews`. Unused-index notices are not an instruction to delete indexes: some may support infrequent admin/reporting paths or constraints. Review query plans and workload before any removal. The multiple permissive policies finding should be reviewed for overlapping SELECT behavior and policy intent.

## Recommended remediation order

1. Inventory all SECURITY DEFINER functions, capture full definitions, and classify each as public booking, admin-only, or internal.
2. Verify every admin-only function checks `auth.uid()` against `admin_users` (or a trusted equivalent) before reading or mutating protected data.
3. Review grants separately from function-body authorization; restrict execution only after callers are mapped and tested.
4. Confirm the six no-policy tables are server-only. Keep browser roles blocked unless a concrete browser use case requires access.
5. Review `guest_reviews` policies and confirm only published reviews are publicly readable.
6. Enable leaked-password protection after confirming Auth settings and reset/login behavior.
7. Run Supabase Security and Performance Advisors again after approved changes.

## Business OS implementation guardrails

- Keep the current Astro + Vercel public site and existing Supabase project.
- Keep new Business OS work on `business-os/phase-0-foundation` until preview-tested.
- Do not add new tables or migrations until the access model, retention rules, and audit requirements are reviewed.
- AI provider credentials must be stored server-side; never expose provider keys in browser code or public environment variables.
- AI-generated content and outbound communications remain drafts until an administrator approves them.
- Spend changes, deletes, booking mutations, publishing, and guest messaging require explicit authorization and audit logging.
- Do not change live bookings, catalogue prices, current Edge Functions, DNS, or production deployment as part of this review.
