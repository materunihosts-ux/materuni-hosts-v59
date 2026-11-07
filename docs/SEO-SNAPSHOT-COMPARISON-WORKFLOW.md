# SEO Snapshot Comparison — Browser Workflow

Status: implemented on the feature branch; browser-only, no database persistence.

## Workflow

1. Run the website crawler in **Marketing & SEO Studio**.
2. Export a JSON snapshot and keep the file as a dated baseline.
3. On a later visit, choose that earlier JSON snapshot in the comparison control.
4. Run a fresh crawl, then select **Compare snapshots**.

The comparison reports:
- URLs newly present and URLs no longer present in the crawl.
- URLs whose observed HTTP status, title, description, H1 count, canonical, robots, viewport, Open Graph title or missing-alt count changed.
- Newly observed and resolved crawler findings.
- URLs with no detected change.

## Validation and safety

- Only schema version 1 snapshots produced by the browser live crawler are accepted.
- Both snapshots must have the same normalized HTTP(S) site origin.
- Duplicate or malformed page paths are rejected.
- Imported JSON is limited to 2 MB in the admin UI.
- Page paths and findings are rendered as text, not interpreted as HTML.
- The comparison is computed locally in the browser. No imported snapshot is uploaded.

## Interpretation limits

This is a comparison of the crawler's observations at two points in time. It does not represent Google Search Console clicks/impressions, search rankings, keyword volume, backlinks, competitor visibility or a Google ranking score. Differences may reflect temporary server responses or crawl-scope changes as well as actual website edits.

## Persistence limitation

The user must keep the exported JSON files. Closing the browser does not create a server-side audit history. Durable shared history remains gated on a separately provisioned staging database, migration review and RLS regression tests. No production Supabase writes or migrations are part of this implementation.
