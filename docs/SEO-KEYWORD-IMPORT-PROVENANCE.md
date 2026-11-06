# SEO Keyword Import — Provenance and Validation

Status: implemented on the feature branch. This changes browser-side CSV import only; no database schema or existing records are modified.

## Supported CSV shapes

The importer classifies incoming headers into three shapes:

- **Search performance export:** query/keyword plus clicks, impressions and position columns. These values are imported into the existing clicks, impressions and current_position fields.
- **Keyword metrics export:** keyword plus a volume column; difficulty is imported when present.
- **Keyword list:** keyword column only, or keyword with intent/target URL.

Classification is based on column names, not file identity. A file with Search Console-like columns is labelled as a user-supplied Search Console-shaped export, not as an authenticated Google Search Console connection. Similarly, keyword volume/difficulty values are not independently verified or represented as measured facts.

## Validation

- Keyword is required and limited to 300 characters.
- Blank and already-known keywords are skipped; duplicate keywords inside the same file are also skipped.
- Search volume, clicks, impressions and position must be non-negative (position must be greater than zero when supplied).
- Difficulty must be between 0 and 100.
- Unsupported intent values fall back to informational.
- Target URLs must be valid HTTP(S) URLs on the configured Materuni Hosts origin. Relative same-origin paths are accepted; external and unsafe schemes are rejected.
- Files larger than 5 MB are rejected.
- Writes remain batched in groups of 100 and use the existing authenticated Supabase Data API path.

## Provenance

Rows continue to use the existing source = csv_import value to avoid requiring a schema change. The import writes a controlled provenance note to the existing notes field describing the detected CSV shape and marks it as user-supplied/unverified. The keyword table now displays the broad source (Manual, CSV import, etc.).

This is not a live Search Console integration. OAuth, API token storage, refresh, revocation, scopes, sync jobs and verified source timestamps are not implemented.

## Tests

`tests/seo-keyword-import.test.js` covers CSV classification, explicit unverified provenance wording, valid normalization, same-origin URL restrictions, numeric bounds, blank rows and intent fallback. The `test:seo` script now runs both the SEO crawl/snapshot and keyword-import suites.

The expanded test command has not yet been executed against a repository checkout in this environment. Do not treat the implementation as build-verified until `npm run test:seo`, `npm run check`, and the full build/quality gate pass in CI or a local checkout.
