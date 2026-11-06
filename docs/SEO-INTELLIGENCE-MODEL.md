# Materuni SEO Intelligence Model v1

Status: read-only application-layer analysis. No database migrations, writes, Storage uploads, scheduled jobs or external API calls.

## Workflow
1. Run a live same-origin crawl in **Admin → Marketing & SEO Studio**.
2. Export the JSON snapshot.
3. Open **Admin → SEO Keyword Studio**, sign in, and upload that snapshot.
4. Run combined analysis against the existing keyword library.

## Inputs and evidence
- Existing `seo_keywords` rows: keyword, intent, target URL, volume, difficulty, position, clicks, impressions, status and source.
- Browser crawl snapshot schema v1: HTTP status, title, meta description, H1 count, canonical, robots, viewport, Open Graph title, image-alt counts, main-content word count and internal-link count.
- Snapshot scope and capture time are preserved. The model chooses the newest observation for each same-origin path when multiple snapshots are supplied.

## Analysis
- Missing and unusually long/short title and description checks.
- Duplicate titles and meta descriptions across the supplied crawl scope.
- Missing canonical, mobile viewport, H1 and Open Graph title checks.
- HTTP errors, noindex directives, image alt gaps and canonical mismatches.
- Main-content depth triage and absence of contextual internal links.
- Keyword-to-page coverage, targets not present in the crawl, and multiple keywords mapped to one page.
- The same normalized keyword assigned to multiple distinct target paths is flagged as a possible competing-page/cannibalization risk for human review; trailing-slash variants are normalized to one path.
- Recommendations carry severity, action, affected URL and observed evidence.

## Methodology guardrails
- A word count below 300 is only a manual-review heuristic, never a Google ranking rule or universal content-length target.
- Title/description character ranges are editorial checks, not guaranteed display lengths or ranking factors.
- Multiple H1s are a hierarchy review, not automatically a penalty.
- A keyword target absent from the current crawl may simply be outside the crawl scope; it is not proof of a 404.
- A page without a keyword mapping is not necessarily underperforming.
- Multiple target paths for one keyword are a mapping conflict signal, not proof of Google cannibalization; confirm intent, rankings and actual search results before changing page ownership.
- Internal-link counts are observed links to a different same-origin path; the crawler does not verify every destination's HTTP status.
- Imported CSV metrics are user-supplied and not independently API-verified. CTR is calculated only from supplied clicks and impressions and must not be represented as authenticated Search Console data.
- Browser crawls do not measure Google rankings, organic traffic, backlinks or indexing.

## Data minimisation and safety
- Snapshot processing happens in the browser; no snapshot upload to Supabase.
- Crawler stores only counts and metadata in the exported JSON, not page body text.
- External URLs, unsafe target URLs and malformed page paths are excluded from mapping.
- Analysis is read-only; no website content or SEO keyword rows are automatically modified.
- Results are advisory. A human should verify cultural accuracy, search intent, page purpose and business priorities before changing public content.

## Tests and release status
Run `npm run test:seo`, then `npm run check` and `npm run build` in a complete repository checkout. These commands have not yet been executed in this remote file-editing session; do not deploy until they pass and the preview is reviewed.
