# Google Search Console connector — Preview setup

Status: code implemented on the feature branch; live Google connection is **not yet configured or verified**.

## What this adds
- A Vercel serverless endpoint at `/api/google-search-console`.
- Administrator authentication using the existing Supabase Auth session and `admin_users` allowlist.
- Google OAuth refresh-token exchange on the server only.
- Read-only Search Analytics requests using the `webmasters.readonly` scope.
- Query and landing-page reports, bounded to 93 days and 250 rows per request.
- CSV export in the browser. No Google data is written to Supabase or persisted by this feature.
- Request timeouts, same-origin checks, bounded request rate, no-store responses, and generic upstream error messages.

## Required Vercel Preview environment variables
Set these only in the **Preview** environment for the linked Vercel project. Never add them to source control, browser variables, a public `.env` file, or a client-side Astro module.

- `GOOGLE_SEARCH_CONSOLE_CLIENT_ID`
- `GOOGLE_SEARCH_CONSOLE_CLIENT_SECRET`
- `GOOGLE_SEARCH_CONSOLE_REFRESH_TOKEN`
- `GOOGLE_SEARCH_CONSOLE_SITE_URL` — exact Search Console property, either `sc-domain:materunihosts.com` or the exact URL-prefix property such as `https://materunihosts.com/`
- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`

The Supabase variables are server-side aliases for the existing public project URL and publishable key. The publishable key is not a service-role secret; authorization is enforced by verifying the user session and checking the existing `admin_users` allowlist.

## Google Cloud setup
1. Use an existing Google Cloud project or create one only after confirming the owner and billing settings. Do not enable paid APIs or billing without approval.
2. Enable the **Google Search Console API**.
3. Configure the OAuth consent screen for the account that owns the Search Console property.
4. Create an OAuth client appropriate for the authorised consent flow. Keep the client secret private.
5. Grant only `https://www.googleapis.com/auth/webmasters.readonly`.
6. Obtain an offline refresh token for the Google account that has access to the exact Search Console property. Do not send the refresh token in chat.
7. Add the four Google variables to Vercel Preview environment variables and redeploy the Preview.

## Important operational notes
- This connector does not implement an in-app OAuth consent callback or token vault. The refresh token is supplied as a server-only Vercel environment variable; rotate it there if revoked.
- The report is explicitly limited to the top 250 rows. Totals shown are sums of returned rows, **not** complete property totals. Search Console can omit anonymised queries.
- Average position shown is the simple mean of returned row positions, not a weighted property-wide average.
- Google data is fetched live on demand; no scheduled sync, historical warehouse, AI actions, or automatic content changes are included.
- The feature is read-only and does not submit URLs, alter Search Console settings, publish pages, or change production data.
- Preview deployment and live Google verification remain separate gates. Do not deploy to production without explicit approval.
