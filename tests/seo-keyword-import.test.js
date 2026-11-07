import test from "node:test";
import assert from "node:assert/strict";
import { classifyKeywordCsv, normalizeKeywordImportRow } from "../src/lib/seo-keyword-import.js";

test("classifies Search Console-shaped exports without claiming API verification", () => {
  const result = classifyKeywordCsv(["Top queries", "Clicks", "Impressions", "CTR", "Position"]);
  assert.equal(result.sourceKind, "search_performance_export");
  assert.match(result.provenanceLabel, /user-supplied CSV; not API-verified/);
  assert.equal(result.columns.keyword, 0);
  assert.equal(result.columns.position, 4);
});

test("classifies keyword metrics and plain keyword-list exports", () => {
  assert.equal(classifyKeywordCsv(["Keyword", "Search Volume", "KD"]).sourceKind, "keyword_metrics_export");
  assert.equal(classifyKeywordCsv(["Keyword"]).sourceKind, "keyword_list");
  assert.throws(() => classifyKeywordCsv(["Search Volume"]), /Keyword or Query/);
});

test("normalizes valid values and restricts imported target URLs to the website origin", () => {
  const { columns } = classifyKeywordCsv(["Query", "Clicks", "Impressions", "Position", "URL"]);
  const row = normalizeKeywordImportRow(["Materuni waterfall tour", "1,200", "8,000", "4.5", "/materuni-waterfall"], columns, "https://materunihosts.com");
  assert.equal(row.value.keyword, "Materuni waterfall tour");
  assert.equal(row.value.clicks, 1200);
  assert.equal(row.value.impressions, 8000);
  assert.equal(row.value.current_position, 4.5);
  assert.equal(row.value.target_url, "https://materunihosts.com/materuni-waterfall");
  assert.equal(row.value.source, "csv_import");
});

test("rejects invalid numeric values and off-site target URLs", () => {
  const { columns } = classifyKeywordCsv(["Keyword", "Search Volume", "Difficulty", "URL"]);
  assert.match(normalizeKeywordImportRow(["keyword", "not-a-number", "20", ""], columns, "https://materunihosts.com").error, /Search volume/);
  assert.match(normalizeKeywordImportRow(["keyword", "20", "101", ""], columns, "https://materunihosts.com").error, /Difficulty/);
  assert.match(normalizeKeywordImportRow(["keyword", "20", "20", "https://evil.example"], columns, "https://materunihosts.com").error, /configured website/);
});

test("skips blank keywords and defaults unsupported intent safely", () => {
  const { columns } = classifyKeywordCsv(["Keyword", "Intent"]);
  assert.deepEqual(normalizeKeywordImportRow(["", ""], columns, "https://materunihosts.com"), { skip: true, reason: "empty_keyword" });
  const row = normalizeKeywordImportRow(["Coffee tour", "made-up"], columns, "https://materunihosts.com");
  assert.equal(row.value.intent, "informational");
});
