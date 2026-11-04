# AI Command Center — Preview Setup

## What is implemented

- A private administrator sign-in gate using Supabase Auth and the existing `admin_users` allowlist.
- A server-side Vercel API endpoint at `/api/business-os-ai`.
- Provider routing for OpenAI, Anthropic Claude, and Google Gemini.
- Provider credentials are read only from server environment variables. No key is shipped to browser JavaScript.
- AI results are drafts only. This endpoint has no publishing, messaging, booking, pricing, ads or other external-action capability.

## Required Vercel environment variables

The existing preview project currently has the public Supabase URL and publishable key configured for Preview and Production. The AI endpoint uses those as fallback for administrator verification.

To enable one provider, add its key in Vercel Project Settings → Environment Variables. Select **Preview** only for the pilot branch. Never paste provider keys into chat, GitHub files, browser code or public variables.

| Variable | Purpose |
|---|---|
| `OPENAI_API_KEY` | OpenAI provider key |
| `OPENAI_MODEL` | Optional model override; default `gpt-4.1-mini` |
| `ANTHROPIC_API_KEY` | Anthropic provider key |
| `ANTHROPIC_MODEL` | Optional model override; default `claude-3-7-sonnet-latest` |
| `GEMINI_API_KEY` | Google AI Studio provider key |
| `GEMINI_MODEL` | Optional model override; default `gemini-2.5-flash` |

Only add the key for a provider that is intended to be tested. Redeploy the Preview after adding it. Production target must remain unchanged until the preview is accepted.

## Privacy and operational limits

- Do not submit guest names, email addresses, phone numbers, payment information, passwords, access tokens, or other sensitive personal data in prompts.
- The selected AI provider receives the prompt. Review that provider's retention and data-processing terms before using it with business-sensitive material.
- This first pilot does not persist prompts or generated drafts in Supabase. The current page keeps the latest output in browser memory and can export a text draft.
- There is no durable usage ledger, approval queue, or server-side per-user rate limit in this first slice. Keep access restricted to trusted admins and monitor provider usage/billing.
- The API checks the Supabase user session and the existing `admin_users` allowlist on every request.
- It rejects cross-origin browser requests and limits prompts to 6,000 characters.
- Provider errors are returned as safe error messages; secrets are never included in API responses.

## Preview test plan

1. Open `/admin/business-os` and sign in as an approved admin.
2. Open the AI Command Center.
3. Without a provider key, verify the UI reports that the selected provider is not connected.
4. Add a Preview-only key in Vercel and redeploy.
5. Generate a harmless test prompt, verify the response is labelled as a draft, and confirm no external action occurs.
6. Verify unauthenticated and non-admin API requests are rejected.
7. Do not promote to Production until the above tests pass.

## Not implemented yet

- Durable AI run history and audit events.
- Database-backed approvals and immutable payload hashes.
- Queue/retry worker and usage budgets.
- OAuth integrations for Google, Meta, WhatsApp, or publishing.
- Automatic actions of any kind.
