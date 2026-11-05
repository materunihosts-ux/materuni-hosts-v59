# Business OS — Approval & Audit Design

Status: PREVIEW POLICY AND DESIGN ONLY. No database tables, RLS policies, triggers, functions, or external-action workers were created by this change.

## Purpose

The Approval Center is a governance boundary for Materuni Hosts. It prevents an AI draft or an operator's proposal from being treated as permission to perform a consequential action.

The current `/admin/approvals` page is an authenticated policy preview. It is not a live queue and cannot approve or execute anything.

## Approval-required action classes

| Action class | Examples | Default rule |
|---|---|---|
| Guest communication | WhatsApp, email, bulk follow-up, guest reply | Approval before sending |
| Public content | Website changes, social publishing, offers | Approval before publishing |
| Spend | Ad budget, bids, subscriptions, paid campaigns | Approval before spend or activation |
| Booking and guest data | Confirm/cancel/delete/change booking, edit guest record | Approval before mutation |
| Prices and payments | Official price, discount, refund, payment settings | Owner approval |
| Access and integrations | OAuth connection, role change, credential rotation | Owner approval |

Read-only analysis, internal summaries, SEO research and draft generation may proceed under admin access and privacy rules. Drafting does not imply approval.

## Approval invariants

1. **Immutable proposal version:** persist a canonical JSON payload and SHA-256 hash. The hash must be computed server-side from a stable canonical representation.
2. **No approval drift:** execution must recompute the hash and reject if it differs from the approved hash.
3. **Separation of duties:** for high-impact actions, requester and approver must be different users. A future owner override, if ever required, must be explicit and audited.
4. **Expiry:** pending approvals expire; an expired or rejected approval can never execute.
5. **One-time execution:** use a unique idempotency key and an atomic state transition so retries cannot execute twice.
6. **Re-authorisation:** immediately before execution, verify the approver/requester's current workspace role and action permission. Do not trust a stale browser decision.
7. **Audit completeness:** record request, decision, execution attempt and outcome. Never log provider keys, access tokens, payment credentials or unnecessary guest PII.
8. **Fail closed:** if the database, authorization check, payload hash, or audit write fails, do not execute the external action.

## Proposed approval record additions

The earlier core data model remains a starting point. Before migration, include these fields or equivalent constraints:

- `payload_hash text not null` — server-computed SHA-256.
- `payload_version integer not null` — schema version for the proposal.
- `action_scope jsonb not null` — destination, channel, audience, target record and amount/currency where applicable.
- `requested_by uuid not null`, `decided_by uuid`, `decision_note text`.
- `status` with constrained transitions: pending → approved/rejected/expired; approved → executing; executing → executed/execution_failed.
- `expires_at timestamptz not null`, `decided_at`, `executed_at`.
- `idempotency_key uuid not null unique`.
- `created_at` and `updated_at` maintained server-side.

The exact action payload must be visible to the approver before approval. Do not allow a generic "approve all" action.

## Audit event model

Audit events should be append-only for application roles. Recommended event types:

- `approval.requested`
- `approval.approved`
- `approval.rejected`
- `approval.expired`
- `action.execution_started`
- `action.execution_succeeded`
- `action.execution_failed`
- `authorization.denied`
- `integration.connected` / `integration.disconnected`

Each event should include workspace, actor ID/type, event type, target type/ID, request/correlation ID, approval ID where applicable, timestamp, and redacted metadata. Normal browser roles must not UPDATE or DELETE audit rows. A retention/export policy must be agreed before implementation.

## Supabase security design notes

- Keep all Business OS tables under RLS in the exposed `public` schema, or move internal audit/queue tables into a non-exposed schema if the selected architecture supports it.
- Do not rely on `TO authenticated` alone. Each policy must verify the user is an approved Materuni Hosts administrator or a member with the required workspace role.
- Do not use user-editable `user_metadata` for authorization.
- Avoid SECURITY DEFINER functions unless strictly necessary. If used, place internal helpers in a non-exposed schema, set a safe search_path, check `auth.uid()`/role explicitly, and grant EXECUTE only to intended roles.
- The service-role key remains server-only. Browser code never gets direct access to job claiming, approval execution, or provider secrets.
- Keep current `admin_users` authorization as the source of truth during the first pilot until a deliberate role migration is tested.
- Existing no-policy tables are not a reason to add broad policies. Review their intended server-only access separately.

Supabase's current RLS guidance requires RLS on exposed tables and explicit policies/grants; see [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security) and [Securing your API](https://supabase.com/docs/guides/api/securing-your-api).

## Required test matrix before any live migration

| Test identity | Read policy | Request approval | Decide approval | Execute action |
|---|---|---|---|---|
| anon | Deny | Deny | Deny | Deny |
| signed-in non-admin | Deny | Deny | Deny | Deny |
| approved admin/operator | Scoped | Allowed by policy | Deny own high-impact request | Deny direct execution |
| approved owner | Scoped | Allowed | Allowed, except self-approval rule | Only through worker |
| server worker | Server-only | N/A | Re-check current approval | Idempotent worker only |

Tests must also cover changed payload hash, expired approval, duplicate idempotency key, revoked admin access, audit-write failure, provider timeout, and retry after partial external failure.

## Rollout sequence

1. Review the policy and agree owner/operator roles, expiry windows, and audit retention.
2. Design the schema and RLS policies in a disposable test project.
3. Test RLS and RPC access as anon, ordinary authenticated user, admin, owner and server worker.
4. Add the read-only approval queue and audit viewer.
5. Add a server-only execution worker with no live integrations initially.
6. Simulate actions and failures; prove idempotency and audit completeness.
7. Only then request approval to apply a migration to the existing live Supabase project.
8. Enable one integration at a time, initially in dry-run mode.

## Current implementation status

- Approval policy page: implemented in preview.
- Business OS navigation link: implemented.
- Durable approval records: not implemented.
- Append-only audit storage: not implemented.
- Execution worker: not implemented.
- External actions: disabled.

No live Supabase schema or production deployment was changed for this work.
