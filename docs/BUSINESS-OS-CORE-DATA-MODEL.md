# Materuni Hosts Business OS — Core Data Model Proposal

Status: DESIGN ONLY — not a database migration.

## Design goals

- Extend the existing Supabase project without replacing the current booking, catalogue, CRM, or admin data.
- Keep provider credentials and privileged actions server-side.
- Record every AI run, approval, and consequential action.
- Require a human approval before publishing, sending guest messages, changing ad spend, deleting records, or mutating bookings.
- Make retries safe through idempotency keys and explicit job states.
- Start with Materuni Hosts as the first workspace while keeping a clean workspace boundary for future clients.

## Proposed tables

### 1. business_os_workspaces

One row per business workspace.

Suggested fields:
- `id uuid primary key`
- `name text not null`
- `slug text unique not null`
- `status text check (status in ('active','paused'))`
- `created_at timestamptz`

Initial row: Materuni Hosts. Do not copy or migrate booking data into this table.

### 2. business_os_members

Maps existing Supabase users to a workspace and a scoped role.

Suggested fields:
- `id uuid primary key`
- `workspace_id uuid references business_os_workspaces`
- `user_id uuid references auth.users`
- `role text check (role in ('owner','admin','operator','viewer'))`
- `created_at timestamptz`
- unique (`workspace_id`, `user_id`)

Initial rollout should map the existing approved administrator deliberately. Do not automatically treat every authenticated account as an admin. Consider whether existing `admin_users` should remain the source of truth during Phase 1 rather than duplicating authorization prematurely.

### 3. business_os_ai_runs

One record for each agent/task execution.

Suggested fields:
- `id uuid primary key`
- `workspace_id uuid not null`
- `requested_by uuid`
- `agent_key text not null`
- `provider_key text not null` (provider/model identifier only; never a secret)
- `task_type text not null`
- `status text check (status in ('queued','running','succeeded','failed','cancelled'))`
- `input_summary jsonb` (redacted; no passwords, API keys, or unnecessary guest PII)
- `output jsonb` (draft/result, with size limits)
- `error_code text`
- `started_at timestamptz`
- `finished_at timestamptz`
- `created_at timestamptz`

### 4. business_os_approvals

Stores explicit human decisions before consequential actions.

Suggested fields:
- `id uuid primary key`
- `workspace_id uuid not null`
- `ai_run_id uuid references business_os_ai_runs`
- `action_type text not null`
- `payload jsonb not null` (the exact proposed action, versioned)
- `status text check (status in ('pending','approved','rejected','expired','executed','execution_failed'))`
- `requested_by uuid`
- `decided_by uuid`
- `decision_note text`
- `expires_at timestamptz`
- `decided_at timestamptz`
- `executed_at timestamptz`
- `idempotency_key uuid unique`
- `created_at timestamptz`

Approval must bind to the exact payload hash. If the payload changes, the prior approval is invalid and a new approval is required. The execution worker must re-check the approver's current authorization and the approval state immediately before executing.

### 5. business_os_audit_events

Append-only record of sensitive actions.

Suggested fields:
- `id bigint generated always as identity primary key`
- `workspace_id uuid not null`
- `actor_user_id uuid`
- `actor_type text check (actor_type in ('user','system','agent'))`
- `event_type text not null`
- `target_type text`
- `target_id text`
- `approval_id uuid references business_os_approvals`
- `request_id uuid`
- `metadata jsonb` (redacted and size-limited)
- `created_at timestamptz not null default now()`

No UPDATE/DELETE path for normal app roles. Retention and export requirements must be agreed before deployment.

### 6. business_os_jobs

Durable queue metadata for work that may need retries.

Suggested fields:
- `id uuid primary key`
- `workspace_id uuid not null`
- `job_type text not null`
- `status text check (status in ('queued','running','retry_wait','succeeded','failed','dead_letter','cancelled'))`
- `payload jsonb not null` (references/IDs, not secrets)
- `attempt_count integer not null default 0`
- `max_attempts integer not null default 5`
- `available_at timestamptz not null default now()`
- `locked_at timestamptz`
- `locked_by text`
- `last_error_code text`
- `created_at timestamptz not null default now()`
- `finished_at timestamptz`

Use atomic claiming/locking and bounded retries. Do not use a browser timer as a job queue.

### 7. business_os_provider_connections

Stores provider metadata, never raw API keys.

Suggested fields:
- `id uuid primary key`
- `workspace_id uuid not null`
- `provider_key text not null` (openai, anthropic, google, meta, google_ads, etc.)
- `credential_ref text` (reference to a server-side secret manager/environment variable)
- `status text check (status in ('not_connected','connected','needs_attention','disabled'))`
- `scopes jsonb`
- `last_verified_at timestamptz`
- `created_at timestamptz`
- `updated_at timestamptz`
- unique (`workspace_id`, `provider_key`)

Never store API keys in a browser-accessible table, localStorage, client-side environment variable, AI prompt, audit payload, or job payload.

## Authorization model

- Browser users: read only their permitted workspace views; never direct access to provider secrets or raw job execution.
- Owner/admin: may request and approve actions according to role policy.
- Operator: may create drafts and request approval, but cannot approve their own high-impact actions by default.
- Viewer: read-only access.
- Service worker: service-role access only from trusted server-side execution; service role must never be exposed to the browser.
- Existing `admin_users` remains the current authorization source until a reviewed migration and dual-check transition are approved.

## Approval policy

Always require approval for:
- Publishing social posts or website content.
- Sending bulk or one-to-one guest messages generated by AI.
- Changing advertising budgets, bids, or campaign status.
- Deleting data or permanently cancelling/deleting bookings.
- Updating official prices, payment settings, or integrations.
- Any action that spends money or discloses guest data externally.

Drafting, internal summarization, SEO analysis, and read-only analytics may run without approval, subject to access controls and privacy-safe inputs.

## Rollout plan

1. Review this model and agree roles, retention, and approval policy.
2. Map existing `admin_users` and existing admin routes; avoid duplicate auth.
3. Build read-only UI and server-side provider configuration first.
4. Create a reviewed migration in a non-production/test project.
5. Test RLS and RPC behavior as anon, ordinary authenticated user, approved admin, and service worker.
6. Only after passing tests, propose applying the migration to the live project.
7. Add AI run queue and approvals; keep all external actions disabled until a real approval/execution audit passes.

## Explicit non-goals for this proposal

- No live schema changes.
- No copying booking or guest records.
- No provider API keys or OAuth tokens stored in these tables.
- No autonomous publishing, guest messaging, or advertising spend changes.
- No change to the current public website architecture.
