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

test("detects duplicate metadata, thin content, weak internal linking and keyword mapping gaps", () => {
  const model = buildSeoIntelligenceModel({
    siteOrigin: "https://materunihosts.com",
    keywords: [
      { keyword: "Materuni waterfall tour", source: "manual", target_url: "https://materunihosts.com/waterfall" },
      { keyword: "Materuni waterfall hike", source: "csv_import", target_url: "https://materunihosts.com/waterfall" },
      { keyword: "Coffee experience", source: "manual", target_url: "https://materunihosts.com/missing-page" }
    ],
    snapshots: [{
      schemaVersion: 1, source: "browser_live_crawl", siteOrigin: "https://materunihosts.com", capturedAt: "2026-11-06T12:00:00Z",
      pages: [
        { path: "/waterfall", status: 200, title: "Materuni Waterfall Experience", description: "Explore Materuni waterfall with local Chagga hosts and learn about village life, traditions and the beautiful forest trail.", h1Count: 1, hasViewport: true, wordCount: 110, internalLinkCount: 0, imageCount: 3, imagesMissingAlt: 1, canonicalUrl: "https://materunihosts.com/waterfall", findings: [] },
        { path: "/coffee", status: 200, title: "Materuni Waterfall Experience", description: "Explore Materuni waterfall with local Chagga hosts and learn about village life, traditions and the beautiful forest trail.", h1Count: 1, hasViewport: true, wordCount: 550, internalLinkCount: 4, imageCount: 2, imagesMissingAlt: 0, canonicalUrl: "https://materunihosts.com/coffee", findings: [] }
      ]
    }]
  });
  const codes = model.recommendations.map((r) => r.code);
  assert.ok(codes.includes("duplicate_title"));
  assert.ok(codes.includes("duplicate_description"));
  assert.ok(codes.includes("thin_content_review"));
  assert.ok(codes.includes("no_internal_links"));
  assert.ok(codes.includes("missing_image_alt"));
  assert.ok(codes.includes("multiple_keywords_same_target"));
  assert.ok(codes.includes("keyword_target_not_crawled"));
  assert.ok(codes.includes("no_keyword_mapping"));
  assert.equal(model.summary.highPriority, 0);
  assert.ok(model.summary.mediumPriority > 0);
});

test("normalizes hostile paths and does not let older snapshots overwrite newer pages", () => {
  const model = buildSeoIntelligenceModel({
    siteOrigin: "https://materunihosts.com",
    snapshots: [
      { schemaVersion: 1, source: "browser_live_crawl", siteOrigin: "https://materunihosts.com", capturedAt: "2026-11-06T12:00:00Z", pages: [{ path: "/page", title: "Latest" }, { path: "//evil.example/path", title: "Bad" }] },
      { schemaVersion: 1, source: "browser_live_crawl", siteOrigin: "https://materunihosts.com", capturedAt: "2026-11-05T12:00:00Z", pages: [{ path: "/page", title: "Old" }] }
    ]
  });
  assert.equal(model.pages.length, 1);
  assert.equal(model.pages[0].title, "Latest");
  assert.equal(model.pages[0].path, "/page");
});


test("flags the same keyword assigned to competing target pages without discarding either mapping", () => {
  const model = buildSeoIntelligenceModel({
    siteOrigin: "https://materunihosts.com",
    keywords: [
      { keyword: "Materuni waterfall tour", source: "manual", target_url: "https://materunihosts.com/waterfall" },
      { keyword: "materuni waterfall tour", source: "csv_import", target_url: "https://materunihosts.com/day-trips" },
      { keyword: "Materuni waterfall tour", source: "manual", target_url: "https://materunihosts.com/waterfall/" }
    ],
    snapshots: []
  });
  const conflicts = model.recommendations.filter((item) => item.code === "keyword_multiple_targets");
  assert.equal(conflicts.length, 2);
  assert.deepEqual(conflicts.map((item) => item.page).sort(), [
    "https://materunihosts.com/day-trips",
    "https://materunihosts.com/waterfall"
  ]);
  assert.ok(conflicts.every((item) => item.severity === "medium"));
  assert.ok(conflicts.every((item) => item.evidence.includes("Materuni waterfall tour")));
});

test("does not flag a keyword mapped repeatedly to the same normalised path", () => {
  const model = buildSeoIntelligenceModel({
    siteOrigin: "https://materunihosts.com",
    keywords: [
      { keyword: "Materuni coffee tour", target_url: "https://materunihosts.com/coffee" },
      { keyword: "materuni coffee tour", target_url: "https://materunihosts.com/coffee/" }
    ]
  });
  assert.equal(model.recommendations.filter((item) => item.code === "keyword_multiple_targets").length, 0);
});
