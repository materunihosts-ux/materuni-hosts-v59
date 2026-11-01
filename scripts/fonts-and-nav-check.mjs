// Runtime verification of webfont delivery, mobile navigation and skip link.
// Serves ./dist and asserts, in a real Chromium:
//   1. Fraunces and Source Sans 3 are actually loaded (document.fonts.check),
//      not merely named in a CSS font stack.
//   2. No font request fails (network status >= 400 / request failure).
//   3. Headings resolve to Fraunces and body copy to Source Sans 3.
//   4. At 360px the menu toggle opens the menu and /camping is visible,
//      clickable and navigates to the camping page.
//   5. The skip link is the first focusable element and becomes visible on focus.
// Usage: node scripts/fonts-and-nav-check.mjs   (run after `astro build`)
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("/opt/appjet/browser/node_modules/playwright");

const ROOT = path.resolve("dist");
const CHROME = "/opt/appjet/browser-binaries/chromium-1234/chrome-linux64/chrome";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".woff2": "font/woff2",
};

function resolveFile(urlPath) {
  let clean = decodeURIComponent(urlPath.split("?")[0]);
  if (clean.endsWith("/")) clean += "index.html";
  let file = path.join(ROOT, clean);
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
  if (!fs.existsSync(file) && fs.existsSync(file + ".html")) file += ".html";
  if (!fs.existsSync(file) && fs.existsSync(path.join(file, "index.html"))) file = path.join(file, "index.html");
  return fs.existsSync(file) ? file : null;
}

const server = http.createServer((req, res) => {
  const file = resolveFile(req.url || "/");
  if (!file) {
    res.writeHead(404, { "content-type": "text/plain" });
    res.end("not found");
    return;
  }
  res.writeHead(200, { "content-type": MIME[path.extname(file)] || "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
});

const failures = [];
const notes = [];

let port = 0;
await new Promise((resolve) => {
  server.listen(0, "127.0.0.1", () => {
    port = server.address().port;
    resolve();
  });
});

const browser = await chromium.launch({
  executablePath: fs.existsSync(CHROME) ? CHROME : undefined,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  const fontFailures = [];
  const consoleErrors = [];

  page.on("requestfailed", (req) => {
    const url = req.url();
    if (/fonts\.(googleapis|gstatic)\.com/.test(url)) {
      fontFailures.push(`${url} -> ${req.failure()?.errorText || "request failed"}`);
    }
  });
  page.on("response", (res) => {
    const url = res.url();
    if (/fonts\.(googleapis|gstatic)\.com/.test(url) && res.status() >= 400) {
      fontFailures.push(`${url} -> HTTP ${res.status()}`);
    }
  });
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text().slice(0, 200));
  });

  for (const route of ["/", "/experiences"]) {
    await page.goto(`http://127.0.0.1:${port}${route}`, { waitUntil: "load", timeout: 30000 });
    const fontState = await page.evaluate(async () => {
      await document.fonts.ready;
      const heading = document.querySelector("h1");
      const body = document.body;
      return {
        frauncesLoaded: document.fonts.check('700 32px "Fraunces"'),
        sourceSansLoaded: document.fonts.check('400 16px "Source Sans 3"'),
        headingStack: heading ? getComputedStyle(heading).fontFamily : "",
        bodyStack: getComputedStyle(body).fontFamily,
        loadedFamilies: [...document.fonts].map((f) => `${f.family}:${f.status}`),
      };
    });

    if (!fontState.frauncesLoaded) failures.push(`${route}: Fraunces is not loaded (document.fonts.check false)`);
    if (!fontState.sourceSansLoaded) failures.push(`${route}: Source Sans 3 is not loaded (document.fonts.check false)`);
    if (!/Fraunces/i.test(fontState.headingStack)) failures.push(`${route}: h1 font stack lacks Fraunces (${fontState.headingStack})`);
    if (!/Source Sans 3/i.test(fontState.bodyStack)) failures.push(`${route}: body font stack lacks Source Sans 3 (${fontState.bodyStack})`);
    notes.push(`${route}: heading "${fontState.headingStack}" | body "${fontState.bodyStack}" | fonts loaded -> ${fontState.loadedFamilies.join(", ") || "none"}`);
  }

  // Skip link must be the first focusable element and visible when focused.
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "load", timeout: 30000 });
  await page.keyboard.press("Tab");
  const skip = await page.evaluate(() => {
    const el = document.activeElement;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    return {
      text: (el.textContent || "").trim().slice(0, 40),
      href: el.getAttribute("href"),
      visible: rect.width > 1 && rect.height > 1 && rect.top > -1 && style.visibility !== "hidden" && style.opacity !== "0",
    };
  });
  if (!skip || !skip.href || !skip.href.startsWith("#")) failures.push(`First Tab stop is not the skip link: ${JSON.stringify(skip)}`);
  else if (!skip.visible) failures.push(`Skip link "${skip.text}" is not visible when focused`);
  else notes.push(`Skip link focused and visible: "${skip.text}" -> ${skip.href}`);

  // Mobile navigation: open the toggle at 360px and reach /camping.
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "load", timeout: 30000 });
  const toggle = page.locator(".menu-toggle").first();
  if ((await toggle.count()) === 0) failures.push("No .menu-toggle found at 360px");
  else {
    const box = await toggle.boundingBox();
    if (!box || box.width < 24 || box.height < 24) failures.push(`Menu toggle target too small: ${JSON.stringify(box)}`);
    await toggle.click();
    const camping = page.locator('header a[href="/camping"]').first();
    const visible = await camping.isVisible();
    if (!visible) failures.push("/camping link is not visible after opening the mobile menu at 360px");
    else {
      const cbox = await camping.boundingBox();
      if (!cbox || cbox.height < 24) failures.push(`/camping link touch target too short: ${JSON.stringify(cbox)}`);
      await Promise.all([page.waitForURL("**/camping", { timeout: 15000 }), camping.click()]);
      const status = await page.evaluate(() => document.querySelector("h1")?.textContent?.trim() || "");
      notes.push(`Mobile menu -> /camping navigated, h1 "${status}"`);
    }
  }

  if (fontFailures.length) failures.push(`Failed font requests: ${fontFailures.join(" | ")}`);
  if (consoleErrors.length) notes.push(`Console errors observed: ${consoleErrors.slice(0, 5).join(" | ")}`);
} finally {
  await browser.close();
  server.close();
}

for (const n of notes) console.log(`· ${n}`);
if (failures.length) {
  console.log("\nFAILURES:");
  for (const f of failures) console.log(`✗ ${f}`);
  console.log(`\n${failures.length} failure(s).`);
  process.exit(1);
}
console.log("\n✓ Webfonts load and resolve, skip link is focusable, mobile menu opens and /camping is reachable.");
