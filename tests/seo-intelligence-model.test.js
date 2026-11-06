import test from "node:test";
import assert from "node:assert/strict";
import { buildSeoIntelligenceModel } from "../src/lib/seo-intelligence-model.js";

test("combines keywords and crawl pages with explicit provenance", () => {
  const model = buildSeoIntelligenceModel({
    siteOrigin: "https://materunihosts.com",
    keywords: [
      { keyword: "Materuni waterfall", source: "csv_import", clicks: 4, impressions: 100, current_position: 8 },
      { keyword: "materuni waterfall", source: "manual" },
      { keyword: "Coffee tour", source: "unknown", intent: "bad-intent", target_url: "https://evil.example/" }
    ],
    snapshots: [{
      schemaVersion: 1, source: "browser_live_crawl", siteOrigin: "https://materunihosts.com",
      capturedAt: "2026-11-06T10:00:00Z",
      pages: [{ path: "/tour", status: 200, title: "", description: "", h1Count: 0, hasViewport: false, findings: [] }]
    }]
  });
  assert.equal(model.summary.keywordCount, 2);
  assert.equal(model.summary.crawlPageCount, 1);
  assert.equal(model.summary.keywordCtr, 0.04);
  assert.equal(model.keywords[0].provenance, "user_supplied_csv_unverified");
  assert.equal(model.keywords[1].targetUrl, null);
  assert.equal(model.keywords[1].intent, "informational");
  assert.ok(model.recommendations.some((r) => r.code === "missing_title"));
  assert.ok(model.recommendations.some((r) => r.code === "missing_viewport"));
  assert.match(model.dataSources.warning, /not independently API-verified/);
});

test("ignores snapshots from another site and rejects invalid site origins", () => {
  const model = buildSeoIntelligenceModel({
    siteOrigin: "https://materunihosts.com",
    snapshots: [{ schemaVersion: 1, source: "browser_live_crawl", siteOrigin: "https://evil.example", pages: [{ path: "/" }] }]
  });
  assert.equal(model.summary.crawlPageCount, 0);
  assert.throws(() => buildSeoIntelligenceModel({ siteOrigin: "javascript:alert(1)" }), /valid HTTP/);
});

test("keeps the newest crawl observation for each page path", () => {
  const base = { schemaVersion: 1, source: "browser_live_crawl", siteOrigin: "https://materunihosts.com" };
  const model = buildSeoIntelligenceModel({
    siteOrigin: "https://materunihosts.com",
    snapshots: [
      { ...base, capturedAt: "2026-11-05T00:00:00Z", pages: [{ path: "/", title: "Old", findings: [] }] },
      { ...base, capturedAt: "2026-11-06T00:00:00Z", pages: [{ path: "/", title: "New", findings: [] }] }
    ]
  });
  assert.equal(model.pages.length, 1);
  assert.equal(model.pages[0].title, "New");
});
