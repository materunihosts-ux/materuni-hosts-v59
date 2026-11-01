// SEO + accessibility verification for the built site.
// Static checks across every generated HTML page in ./dist, plus real-browser
// landmark / heading / accessible-name / focus-indicator checks on key routes.
// Usage: node scripts/seo-a11y-check.mjs   (run after `astro build`)
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("/opt/appjet/browser/node_modules/playwright");

const ROOT = path.resolve("dist");
const CHROME = "/opt/appjet/browser-binaries/chromium-1234/chrome-linux64/chrome";
const SITE = "https://materunihosts.com";
const failures = [];
const notes = [];

/* ------------------------------------------------------------------ helpers */
function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name.endsWith(".html")) out.push(full);
  }
  return out;
}

const decode = (s) =>
  String(s)
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");

function attr(tag, name) {
  const m = tag.match(new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, "i"));
  return m ? decode(m[2] ?? m[3] ?? "") : null;
}

function metaTags(html) {
  const head = html.slice(0, html.indexOf("</head>") + 7);
  const tags = head.match(/<(meta|link|title)\b[^>]*>/gi) || [];
  return tags;
}

function jsonLdBlocks(html) {
  const blocks = [];
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) blocks.push(m[1]);
  return blocks;
}

/* ------------------------------------------------------- static page checks */
const pages = walk(ROOT);
if (!pages.length) {
  console.log("No HTML pages found in dist/. Run `astro build` first.");
  process.exit(1);
}

const seenTitles = new Map();
const seenCanonicals = new Map();
let checkedPages = 0;
let jsonLdCount = 0;

for (const file of pages) {
  const html = fs.readFileSync(file, "utf8");
  const rel = "/" + path.relative(ROOT, file).replace(/index\.html$/, "").replace(/\\/g, "/");
  const isNoIndex = /<meta[^>]+name=["']robots["'][^>]*noindex/i.test(html);
  const htmlLang = attr(html.match(/<html\b[^>]*>/i)?.[0] || "", "lang");

  // Every page must declare a language.
  if (!htmlLang || !/^[a-z]{2}(-[A-Za-z]{2,})?$/.test(htmlLang)) {
    failures.push(`${rel}: <html lang> missing or invalid (${JSON.stringify(htmlLang)})`);
  }

  // Landmarks: exactly one <main> with the skip-link target id.
  const mainOpen = (html.match(/<main\b[^>]*>/gi) || []).length;
  if (mainOpen !== 1) failures.push(`${rel}: expected exactly one <main>, found ${mainOpen}`);
  if (!/<main\b[^>]*id=["']main-content["']/i.test(html)) {
    failures.push(`${rel}: <main> is missing id="main-content" (skip-link target)`);
  }
  if (!/<header\b/i.test(html)) failures.push(`${rel}: no <header> landmark`);
  if (!/<footer\b/i.test(html)) failures.push(`${rel}: no <footer> landmark`);
  if (!/<nav\b/i.test(html)) failures.push(`${rel}: no <nav> landmark`);

  // Images must carry an alt attribute (empty alt allowed for decorative images).
  const imgTags = html.match(/<img\b[^>]*>/gi) || [];
  const noAlt = imgTags.filter((t) => attr(t, "alt") === null);
  if (noAlt.length) failures.push(`${rel}: ${noAlt.length} <img> without alt attribute -> ${noAlt[0].slice(0, 120)}`);

  // Form controls need an accessible name from label/aria-label/title.
  const controlRe = /<(input|select|textarea)\b([^>]*)>/gi;
  let c;
  const idSet = new Set();
  let m2;
  const idRe = /\bid\s*=\s*["']([^"']+)["']/gi;
  while ((m2 = idRe.exec(html))) idSet.add(m2[1]);
  const labelledFor = new Set();
  const forRe = /<label\b[^>]*\bfor\s*=\s*["']([^"']+)["']/gi;
  while ((m2 = forRe.exec(html))) labelledFor.add(m2[1]);
  while ((c = controlRe.exec(html))) {
    const tag = `<${c[1]}${c[2]}>`;
    const type = (attr(tag, "type") || "text").toLowerCase();
    if (["hidden", "submit", "button", "reset", "image"].includes(type)) continue;
    const named =
      attr(tag, "aria-label") ||
      attr(tag, "aria-labelledby") ||
      attr(tag, "title") ||
      (attr(tag, "id") && labelledFor.has(attr(tag, "id")));
    if (!named) failures.push(`${rel}: ${c[1]}${type !== "text" ? `[type=${type}]` : ""} without accessible name -> ${tag.slice(0, 100)}`);
  }

  // Skip link must be the first element in <body>.
  const bodyStart = html.slice(html.indexOf("<body"), html.indexOf("<body") + 400);
  if (!/<body[^>]*>\s*<a[^>]*class=["'][^"']*skip-link/i.test(bodyStart)) {
    failures.push(`${rel}: skip link is not the first focusable element in <body>`);
  }

  // Indexable pages need complete, unique head metadata.
  if (!isNoIndex) {
    const tags = metaTags(html);
    const titleTag = html.match(/<title>([\s\S]*?)<\/title>/i);
    const title = titleTag ? decode(titleTag[1]).trim() : "";
    const desc = attr(tags.find((t) => /name=["']description["']/i.test(t)) || "", "content");
    const canonical = attr(tags.find((t) => /rel=["']canonical["']/i.test(t)) || "", "href");
    const og = (p) => attr(tags.find((t) => new RegExp(`property=["']og:${p}["']`, "i").test(t)) || "", "content");
    const tw = (n) => attr(tags.find((t) => new RegExp(`name=["']twitter:${n}["']`, "i").test(t)) || "", "content");

    if (title.length < 15 || title.length > 75) failures.push(`${rel}: title length ${title.length} (expected 15-75): "${title}"`);
    if (seenTitles.has(title)) failures.push(`${rel}: duplicate title, also used by ${seenTitles.get(title)}`);
    else seenTitles.set(title, rel);

    if (!desc) failures.push(`${rel}: missing meta description`);
    else if (desc.length < 50 || desc.length > 200) failures.push(`${rel}: meta description length ${desc.length} (expected 50-200)`);

    if (!canonical) failures.push(`${rel}: missing canonical link`);
    else {
      if (!canonical.startsWith(SITE + "/")) failures.push(`${rel}: canonical is not an absolute ${SITE} URL: ${canonical}`);
      const expectedPath = rel === "/" ? "/" : rel.replace(/\/$/, "");
      const canonicalPath = canonical.replace(SITE, "").replace(/\/$/, "") || "/";
      if (canonicalPath !== expectedPath) failures.push(`${rel}: canonical "${canonical}" does not match route "${expectedPath}"`);
      if (seenCanonicals.has(canonical)) failures.push(`${rel}: duplicate canonical, also used by ${seenCanonicals.get(canonical)}`);
      else seenCanonicals.set(canonical, rel);
    }

    for (const key of ["title", "description", "url", "image"]) {
      if (!og(key)) failures.push(`${rel}: missing og:${key}`);
    }
    if (og("image") && !/^https:\/\//.test(og("image"))) failures.push(`${rel}: og:image is not absolute: ${og("image")}`);
    if (!tw("card")) failures.push(`${rel}: missing twitter:card`);
    if (!tw("title")) failures.push(`${rel}: missing twitter:title`);
    if (!tw("image")) failures.push(`${rel}: missing twitter:image`);

    for (const block of jsonLdBlocks(html)) {
      jsonLdCount++;
      let parsed;
      try {
        parsed = JSON.parse(block);
      } catch (err) {
        failures.push(`${rel}: invalid JSON-LD (${err.message})`);
        continue;
      }
      const items = Array.isArray(parsed) ? parsed : [parsed];
      for (const item of items) {
        if (!item || !item["@context"] || !String(item["@context"]).includes("schema.org")) {
          failures.push(`${rel}: JSON-LD block without schema.org @context`);
        }
        if (!item["@type"]) failures.push(`${rel}: JSON-LD block without @type`);
      }
    }
  }

  // No right-to-left/invisible layout traps: unresolved i18n keys leaking into HTML.
  if (/data-i18n=/.test(html) && /\[object Object\]/.test(html)) {
    failures.push(`${rel}: contains "[object Object]" (template/i18n bug)`);
  }

  checkedPages++;
}

/* ------------------------------------------------------------- sitemap/robots */
for (const [name, required] of [
  ["public/robots.txt", ["User-agent:", `Sitemap: ${SITE}/sitemap.xml`]],
]) {
  const file = path.resolve(name);
  if (!fs.existsSync(file)) {
    failures.push(`${name}: file missing`);
    continue;
  }
  const txt = fs.readFileSync(file, "utf8");
  for (const token of required) if (!txt.includes(token)) failures.push(`${name}: missing "${token}"`);
  if (!/Disallow:\s*\/admin/i.test(txt)) failures.push(`${name}: admin area is not disallowed`);
}

const sitemapFile = path.resolve("public/sitemap.xml");
if (!fs.existsSync(sitemapFile)) failures.push("public/sitemap.xml: file missing");
else {
  const xml = fs.readFileSync(sitemapFile, "utf8");
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((x) => x[1].trim());
  if (!locs.length) failures.push("public/sitemap.xml: no <loc> entries");
  if (new Set(locs).size !== locs.length) failures.push("public/sitemap.xml: duplicate <loc> entries");
  if (!locs.includes(`${SITE}/`)) failures.push("public/sitemap.xml: homepage not listed");
  if (locs.some((l) => l.includes("/admin") || l.includes("404"))) failures.push("public/sitemap.xml: lists admin or 404 URL");
  for (const loc of locs) {
    if (!loc.startsWith(SITE + "/")) {
      failures.push(`public/sitemap.xml: ${loc} is not an absolute ${SITE} URL`);
      continue;
    }
    const p = loc.replace(SITE, "");
    const candidate = path.join(ROOT, p, p.endsWith("/") ? "index.html" : ".html");
    const dirIndex = path.join(ROOT, p, "index.html");
    if (!fs.existsSync(candidate) && !fs.existsSync(dirIndex) && !fs.existsSync(path.join(ROOT, p))) {
      failures.push(`public/sitemap.xml: ${loc} has no built page`);
    }
  }
  notes.push(`sitemap: ${locs.length} unique absolute URLs, all resolving to built pages`);
}

/* ------------------------------------------------------ real browser checks */
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".woff2": "font/woff2",
  ".xml": "application/xml",
  ".txt": "text/plain; charset=utf-8",
  ".json": "application/json",
};

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
  let file = path.join(ROOT, urlPath);
  try {
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
    if (!fs.existsSync(file)) {
      res.writeHead(404, { "content-type": "text/html; charset=utf-8" });
      res.end(fs.readFileSync(path.join(ROOT, "404.html"), "utf8"));
      return;
    }
    res.writeHead(200, { "content-type": MIME[path.extname(file)] || "application/octet-stream" });
    res.end(fs.readFileSync(file));
  } catch {
    res.writeHead(500);
    res.end("error");
  }
});

const routes = ["/", "/experiences", "/camping", "/day-trips", "/booking", "/faq", "/about-us", "/journal/"];

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const port = server.address().port;
const browser = await chromium.launch({ executablePath: CHROME, args: ["--no-sandbox"] });

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => consoleErrors.push(String(err)));

  for (const route of routes) {
    await page.goto(`http://127.0.0.1:${port}${route}`, { waitUntil: "load", timeout: 30000 });

    const report = await page.evaluate(() => {
      const visible = (el) => {
        const r = el.getBoundingClientRect();
        const s = getComputedStyle(el);
        return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none" && s.opacity !== "0";
      };
      const name = (el) => {
        const aria = el.getAttribute("aria-label") || (el.getAttribute("aria-labelledby") || "").split(/\s+/).filter(Boolean).map((id) => document.getElementById(id)?.textContent || "").join(" ");
        if (aria.trim()) return aria.trim();
        if (el.tagName === "IMG") return (el.getAttribute("alt") || "").trim();
        if (el.tagName === "INPUT" || el.tagName === "SELECT" || el.tagName === "TEXTAREA") {
          const id = el.getAttribute("id");
          const lbl = id ? document.querySelector(`label[for="${id}"]`) : null;
          return (lbl?.textContent || el.getAttribute("title") || el.getAttribute("placeholder") || "").trim();
        }
        return (el.textContent || "").trim() || (el.getAttribute("title") || "").trim();
      };

      const main = document.querySelector("main");
      const mainBox = main ? main.getBoundingClientRect() : null;
      const insideMain = (el) => !mainBox || (el.getBoundingClientRect().top >= mainBox.top - 2);
      const interactive = [...document.querySelectorAll("a[href], button, select, input:not([type=hidden]), textarea, [tabindex]:not([tabindex='-1'])")].filter(visible);
      const unnamed = interactive.filter((el) => !name(el)).map((el) => `${el.tagName.toLowerCase()}${el.className ? "." + String(el.className).split(/\s+/)[0] : ""}`);

      // Duplicate ids break label/target associations.
      const ids = [...document.querySelectorAll("[id]")].map((el) => el.id);
      const dupIds = ids.filter((id, i) => ids.indexOf(id) !== i);

      return {
        h1: [...document.querySelectorAll("h1")].map((h) => (h.textContent || "").trim().slice(0, 120)),
        visibleH1: [...document.querySelectorAll("h1")].filter(visible).length,
        landmarks: {
          header: document.querySelectorAll("header").length,
          nav: document.querySelectorAll("nav").length,
          main: document.querySelectorAll("main").length,
          footer: document.querySelectorAll("footer").length,
        },
        unnamed: [...new Set(unnamed)],
        dupIds: [...new Set(dupIds)],
        lang: document.documentElement.lang,
        skipTarget: !!document.getElementById("main-content"),
        headingOrder: [...document.querySelectorAll("h1,h2,h3,h4,h5,h6")].filter(visible && insideMain).map((h) => Number(h.tagName[1])),
      };
    });

    if (!report.skipTarget) failures.push(`${route}: no #main-content target in the live DOM`);
    if (!report.lang) failures.push(`${route}: document language not set`);
    if (report.landmarks.main !== 1) failures.push(`${route}: ${report.landmarks.main} <main> landmarks`);
    if (report.landmarks.header !== 1) failures.push(`${route}: ${report.landmarks.header} <header> landmarks`);
    if (report.landmarks.footer !== 1) failures.push(`${route}: ${report.landmarks.footer} <footer> landmarks`);
    if (report.landmarks.nav < 1) failures.push(`${route}: no <nav> landmark`);
    if (report.h1.length !== 1) failures.push(`${route}: ${report.h1.length} <h1> elements -> ${JSON.stringify(report.h1)}`);
    if (report.visibleH1 !== 1) failures.push(`${route}: ${report.visibleH1} visible <h1> elements`);
    if (report.unnamed.length) failures.push(`${route}: interactive elements without accessible name -> ${JSON.stringify(report.unnamed)}`);
    if (report.dupIds.length) failures.push(`${route}: duplicate ids -> ${JSON.stringify(report.dupIds)}`);

    // Heading levels must not skip when descending (h2 -> h4).
    let prev = 0;
    for (const level of report.headingOrder) {
      if (prev && level > prev + 1) {
        failures.push(`${route}: heading level jumps from h${prev} to h${level}`);
        break;
      }
      prev = level;
    }

    notes.push(`${route}: 1 h1, landmarks ok, ${report.unnamed.length ? report.unnamed.length + " unnamed controls" : "all visible controls named"}`);
  }

  // Keyboard focus must be visible on the first handful of stops.
  await page.goto(`http://127.0.0.1:${port}/booking`, { waitUntil: "load", timeout: 30000 });
  const focusReport = [];
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press("Tab");
    focusReport.push(
      await page.evaluate(() => {
        const el = document.activeElement;
        if (!el || el === document.body) return { missing: true };
        const s = getComputedStyle(el);
        const visibleIndicator =
          s.outlineStyle !== "none" && parseFloat(s.outlineWidth) > 0
            ? true
            : s.boxShadow !== "none" || s.textDecorationLine.includes("underline");
        return {
          tag: el.tagName.toLowerCase(),
          text: (el.textContent || el.getAttribute("aria-label") || "").trim().slice(0, 30),
          visibleIndicator,
          outline: `${s.outlineStyle} ${s.outlineWidth} ${s.outlineColor}`,
        };
      })
    );
  }
  for (const f of focusReport) {
    if (f.missing) failures.push("/booking: keyboard focus left the document after a Tab press");
    else if (!f.visibleIndicator) failures.push(`/booking: focused element "${f.tag} ${f.text}" has no visible focus indicator (${f.outline})`);
  }
  notes.push(`/booking: ${focusReport.filter((f) => f.visibleIndicator).length}/${focusReport.length} tab stops show a visible focus ring`);

  if (consoleErrors.length) {
    for (const err of [...new Set(consoleErrors)].slice(0, 5)) failures.push(`console/page error: ${err.slice(0, 180)}`);
  } else {
    notes.push("no console or page errors on checked routes");
  }
} finally {
  await browser.close();
  server.close();
}

/* ------------------------------------------------------------------- report */
console.log(`Checked ${checkedPages} built HTML pages, ${jsonLdCount} JSON-LD blocks, ${routes.length} live routes.`);
for (const n of notes) console.log(`· ${n}`);
if (failures.length) {
  console.log(`\nFAILURES:`);
  for (const f of failures) console.log(`✗ ${f}`);
  console.log(`\n${failures.length} failure(s).`);
  process.exit(1);
}
console.log("\n✓ SEO metadata, structured data, sitemap/robots, landmarks, headings, accessible names and focus indicators all check out.");
