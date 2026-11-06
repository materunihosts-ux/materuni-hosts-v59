import test from "node:test";
import assert from "node:assert/strict";
import { buildAuditCsv, extractSitemapPaths, isSameOriginUrl } from "../src/lib/seo-audit-utils.js";

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
  assert.match(csv, /"\'+cmd"/);
  assert.match(csv, /"'@SUM\(1,1\)"/);
  assert.match(csv, /"'-1 issue"/);
  assert.match(csv, /""https://evil.example""/);
});
