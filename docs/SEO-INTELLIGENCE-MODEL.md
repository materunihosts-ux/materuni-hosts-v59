# Materuni SEO Intelligence Model v1

Status: implemented as a read-only application-layer adapter; no database migration or writes.

## Purpose
Combine the existing keyword library and exported browser crawl snapshots into one normalized model for dashboard analysis. The model is deliberately read-only and can run without adding Supabase tables, storage objects, cron jobs, or background requests.

## Inputs
- Existing `seo_keywords` rows: keyword, intent, target URL, volume, difficulty, position, clicks, impressions, status and source.
- Browser crawl JSON snapshots, schema v1, source `browser_live_crawl`, matching configured site origin.

## Provenance
- `csv_import`: user-supplied CSV, not API-verified.
- `manual`: manually entered keyword.
- `gsc_export`: provider export; not API-verified unless a future authenticated integration records verification.
- Browser crawl: page metadata observed by the browser; not Google ranking, traffic, backlinks or indexing data.

## Output
- Normalized, de-duplicated keyword records.
- Latest crawl observation per same-origin page path.
- Evidence-backed technical recommendations from observed crawl fields.
- Aggregated click/impression totals and CTR only where imported rows contain those values.
- Explicit data-source warnings and provenance on each record.

## Safety and limitations
- No data is written to Supabase.
- No schema changes, storage uploads, Edge Functions, scheduled jobs or extra network calls.
- External target URLs and snapshots from other origins are excluded.
- Recommendations cite the observation that triggered them; they are not ranking guarantees.
- CTR is calculated only from supplied click and impression counts. It must not be presented as verified GSC data for CSV imports.

## Tests
Run `npm run test:seo`. The full repository test and Astro build must still be run in a complete checkout before preview or deployment.
