import test from "node:test";
import assert from "node:assert/strict";
import { buildAuditCsv, buildAuditSnapshot, extractSitemapPaths, isSameOriginUrl } from "../src/lib/seo-audit-utils.js";

test("same-origin validation rejects external and malformed URLs", () => {
  assert.equal(isSameOriginUrl("/materuni", "https://materunihosts.com"), true);
  assert.equal(isSameOriginUrl("https://evil.example/path", "https://materunihosts.com"), false);
  assert.equal(isSameOriginUrl("javascript:alert(1)", "https://materunihosts.com"), false);
  assert.equal(isSameOriginUrl("http://[broken", "https://materunihosts.com"), false);
});

test("sitemap parser keeps unique absolute same-origin paths and ignores unsafe entries", () => {
  const xml = `<urlset>
    <url><loc>https://materunihosts.com/</loc></url>
    <url><loc>https://materunihosts.com/materuni?ref=1</loc></url>
    <url><loc>https://evil.example/steal</loc></url>
    <url><loc>not a valid url [</loc></url>
    <url><loc>https://materunihosts.com/materuni?ref=2</loc></url>
  </urlset>`;
  assert.deepEqual(extractSitemapPaths(xml, "https://materunihosts.com"), ["/", "/materuni"]);
});

test("sitemap parser enforces a bounded URL count", () => {
  const xml = Array.from({ length: 20 }, (_, i) => `<loc>https://materunihosts.com/page-${i}</loc>`).join("");
  assert.equal(extractSitemapPaths(xml, "https://materunihosts.com", 7).length, 7);
  assert.deepEqual(extractSitemapPaths(xml, "https://materunihosts.com", 0), []);
});

test("CSV escapes quotes and neutralises spreadsheet formulas", () => {
  const csv = buildAuditCsv([{ path: "=HYPERLINK(\"https://evil.example\")", status: 200, title: "+cmd", desc: "safe", h1: 1, canonical: "-", robots: "", viewport: true, ogTitle: "@SUM(1,1)", missingAlt: 0, issues: ["-1 issue"] }]);
  assert.match(csv, /'=HYPERLINK/);
  assert.match(csv, /"'\+cmd"/);
  assert.match(csv, /"'@SUM\(1,1\)"/);
  assert.match(csv, /"'-1 issue"/);
  assert.ok(csv.includes('""https://evil.example""'));
});


test("JSON snapshot includes versioned provenance and derived counts", () => {
  const snapshot = buildAuditSnapshot([
    { path: "/materuni", status: 200, title: "Materuni", desc: "A local experience", h1: 1, canonical: "https://materunihosts.com/materuni", robots: "index,follow", viewport: true, ogTitle: "Materuni Hosts", missingAlt: 2, issues: ["Missing alt", "Short title"] }
  ], { siteOrigin: "https://materunihosts.com/path", scope: "sitemap", capturedAt: "2026-11-06T10:00:00Z" });
  assert.equal(snapshot.schemaVersion, 1);
  assert.equal(snapshot.source, "browser_live_crawl");
  assert.equal(snapshot.siteOrigin, "https://materunihosts.com");
  assert.equal(snapshot.pageCount, 1);
  assert.equal(snapshot.issueCount, 2);
  assert.equal(snapshot.pages[0].imagesMissingAlt, 2);
});

test("JSON snapshot rejects invalid origins and missing scope", () => {
  assert.throws(() => buildAuditSnapshot([], { siteOrigin: "javascript:alert(1)", scope: "core" }), /valid HTTP/);
  assert.throws(() => buildAuditSnapshot([], { siteOrigin: "https://materunihosts.com", scope: "all" }), /scope/);
});


import { compareAuditSnapshots } from "../src/lib/seo-audit-utils.js";

function snapshot(pages, capturedAt = "2026-11-06T10:00:00.000Z") {
  return {
    schemaVersion: 1, source: "browser_live_crawl", scope: "core",
    siteOrigin: "https://materunihosts.com", capturedAt, pages
  };
}

test("snapshot comparison detects added, removed, changed and unchanged pages", () => {
  const previous = snapshot([
    { path: "/", status: 200, title: "Home", findings: [] },
    { path: "/old", status: 200, title: "Old", findings: [] },
    { path: "/same", status: 200, title: "Same", findings: [] }
  ]);
  const current = snapshot([
    { path: "/", status: 200, title: "Materuni Hosts", findings: ["Missing description"] },
    { path: "/new", status: 200, title: "New", findings: ["Missing alt"] },
    { path: "/same", status: 200, title: "Same", findings: [] }
  ], "2026-11-07T10:00:00.000Z");
  const diff = compareAuditSnapshots(previous, current);
  assert.deepEqual(diff.added.map(p => p.path), ["/new"]);
  assert.deepEqual(diff.removed, ["/old"]);
  assert.deepEqual(diff.unchanged, ["/same"]);
  assert.equal(diff.changed[0].path, "/");
  assert.deepEqual(diff.changed[0].findings.added, ["Missing description"]);
  assert.equal(diff.summary.newFindings, 2);
  assert.equal(diff.summary.resolvedFindings, 0);
});

test("snapshot comparison reports resolved findings and metadata changes", () => {
  const previous = snapshot([{ path: "/tour", status: 404, title: "Tour", canonicalUrl: "", findings: ["HTTP error", "No H1"] }]);
  const current = snapshot([{ path: "/tour", status: 200, title: "Tour", canonicalUrl: "https://materunihosts.com/tour", findings: ["No H1"] }]);
  const diff = compareAuditSnapshots(previous, current);
  assert.equal(diff.changed[0].fields.status.before, 404);
  assert.equal(diff.changed[0].fields.status.after, 200);
  assert.deepEqual(diff.changed[0].findings.resolved, ["HTTP error"]);
  assert.equal(diff.summary.resolvedFindings, 1);
});

test("snapshot comparison rejects incompatible origins, schema and duplicate paths", () => {
  const base = snapshot([{ path: "/", findings: [] }]);
  assert.throws(() => compareAuditSnapshots(base, { ...base, siteOrigin: "https://other.example" }), /same siteOrigin/);
  assert.throws(() => compareAuditSnapshots(base, { ...base, schemaVersion: 2 }), /schema v1/);
  assert.throws(() => compareAuditSnapshots(base, { ...base, scope: "sitemap" }), /same valid crawl scope/);
  assert.throws(() => compareAuditSnapshots(base, snapshot([{ path: "/", findings: [] }, { path: "/", findings: [] }])), /duplicate page paths/);
});

test("snapshot comparison rejects malformed page paths", () => {
  const base = snapshot([{ path: "/", findings: [] }]);
  assert.throws(() => compareAuditSnapshots(base, snapshot([{ path: "//evil.example", findings: [] }])), /invalid page path/);
});

test("crawl snapshot preserves content quality and internal-link metrics", () => {
  const snapshot = buildAuditSnapshot([{
    path: "/materuni", status: 200, title: "Materuni Village Experience",
    desc: "Discover a local Chagga village experience with hosts in Materuni, Moshi, Tanzania.",
    h1: 1, canonical: "https://materunihosts.com/materuni", robots: "index,follow",
    viewport: true, ogTitle: "Materuni Hosts", missingAlt: 1,
    wordCount: 428, internalLinkCount: 7, imageCount: 4, issues: []
  }], { siteOrigin: "https://materunihosts.com", scope: "core" });
  assert.equal(snapshot.pages[0].wordCount, 428);
  assert.equal(snapshot.pages[0].internalLinkCount, 7);
  assert.equal(snapshot.pages[0].imageCount, 4);
  assert.equal(snapshot.pages[0].titleLength, "Materuni Village Experience".length);
});
