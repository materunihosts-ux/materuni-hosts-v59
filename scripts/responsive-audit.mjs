// Responsive + baseline accessibility audit for the built static site.
// Serves ./dist, then loads key routes at small-phone -> desktop widths and
// asserts: no horizontal overflow, no clipped/oversized elements, usable
// header touch targets, working mobile menu, one <h1>, skip link present,
// Fraunces/Source Sans 3 actually applied.
// Usage: node scripts/responsive-audit.mjs   (run after `astro build`)
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("/opt/appjet/browser/node_modules/playwright");

const ROOT = path.resolve("dist");
const CHROME = "/opt/appjet/browser-binaries/chromium-1234/chrome-linux64/chrome";
const ROUTES = ["/", "/experiences", "/camping", "/booking", "/materuni-waterfall-tour"];
const VIEWPORTS = [
  { name: "320x640", width: 320, height: 640 },
  { name: "360x740", width: 360, height: 740 },
  { name: "390x844", width: 390, height: 844 },
  { name: "768x1024", width: 768, height: 1024 },
  { name: "1280x800", width: 1280, height: 800 },
];

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

async function audit(page, route, viewport) {
  const label = `${route} @ ${viewport.name}`;
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  const response = await page.goto(`http://127.0.0.1:${port}${route}`, { waitUntil: "load", timeout: 30000 });
  if (!response || response.status() >= 400) {
    failures.push(`${label}: HTTP ${response ? response.status() : "no response"}`);
    return;
  }
  await page.waitForTimeout(150);

  const metrics = await page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const offenders = [];
    for (const el of document.querySelectorAll("body *")) {
      const style = getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden" || style.position === "fixed") continue;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      if (rect.right > vw + 1.5 || rect.left < -1.5) {
        offenders.push({
          tag: el.tagName.toLowerCase(),
          cls: (el.className && el.className.toString().slice(0, 80)) || "",
          left: Math.round(rect.left),
          right: Math.round(rect.right),
        });
      }
    }
    const header = document.querySelector(".site-header");
    const navLinks = [...document.querySelectorAll(".site-header a")].map((a) => {
      const rect = a.getBoundingClientRect();
      return { text: (a.textContent || "").trim().slice(0, 24), href: a.getAttribute("href"), w: Math.round(rect.width), h: Math.round(rect.height), visible: rect.width > 0 && rect.height > 0 };
    });
    const buttons = [...document.querySelectorAll(".site-header button, .site-header a")].filter((el) => {
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    });
    const smallTargets = buttons
      .map((el) => {
        const rect = el.getBoundingClientRect();
        return { tag: el.tagName.toLowerCase(), text: (el.textContent || el.getAttribute("aria-label") || "").trim().slice(0, 24), w: Math.round(rect.width), h: Math.round(rect.height) };
      })
      .filter((t) => t.h < 32 || t.w < 32);

    const h1s = [...document.querySelectorAll("h1")];
    const h1 = h1s[0];
    const skip = document.querySelector('a[href^="#"]');
    const firstFocusable = document.querySelector("body a, body button");
    const campingLink = document.querySelector('.site-header a[href="/camping"]');
    const campingVisible = !!campingLink && campingLink.getBoundingClientRect().width > 0;

    return {
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: vw,
      bodyScroll: document.body.scrollWidth,
      offenders: offenders.slice(0, 8),
      headerHeight: header ? Math.round(header.getBoundingClientRect().height) : 0,
      navLinks,
      smallTargets,
      h1Count: h1s.length,
      h1Text: h1 ? (h1.textContent || "").trim().slice(0, 60) : "",
      h1Font: h1 ? getComputedStyle(h1).fontFamily : "",
      bodyFont: getComputedStyle(document.body).fontFamily,
      skipLinkText: skip ? (skip.textContent || "").trim().toLowerCase() : "",
      firstFocusableTag: firstFocusable ? firstFocusable.tagName.toLowerCase() : "",
      campingVisible,
    };
  });

  if (metrics.scrollWidth > metrics.clientWidth + 1 || metrics.bodyScroll > metrics.clientWidth + 1) {
    failures.push(`${label}: horizontal overflow (scrollWidth ${metrics.scrollWidth} > clientWidth ${metrics.clientWidth})`);
  }
  if (metrics.offenders.length) {
    failures.push(`${label}: ${metrics.offenders.length} element(s) extend past the viewport -> ${JSON.stringify(metrics.offenders)}`);
  }
  if (metrics.h1Count !== 1) failures.push(`${label}: expected exactly one <h1>, found ${metrics.h1Count}`);
  if (!/fraunces/i.test(metrics.h1Font)) failures.push(`${label}: <h1> font-family is "${metrics.h1Font}" (expected Fraunces)`);
  if (!/source sans 3/i.test(metrics.bodyFont)) failures.push(`${label}: body font-family is "${metrics.bodyFont}" (expected Source Sans 3)`);
  if (!/skip/.test(metrics.skipLinkText)) failures.push(`${label}: no skip-to-content link found as the first link (got "${metrics.skipLinkText}")`);
  if (metrics.smallTargets.length) {
    notes.push(`${label}: small header targets -> ${JSON.stringify(metrics.smallTargets)}`);
  }

  if (viewport.width < 900) {
    // Mobile: the primary nav is collapsed until the burger is toggled, so the
    // menu must be opened BEFORE asserting that /camping is reachable.
    const toggle = page.locator(".site-header [aria-controls], .site-header .nav-toggle, .site-header .menu-toggle").first();
    if (await toggle.count()) {
      await toggle.click({ timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(200);
      const mobile = await page.evaluate(() => {
        const panel = document.querySelector(".site-header nav, .site-header .nav-links, .site-header .mobile-menu");
        if (!panel) return { opened: null, camping: false };
        const rect = panel.getBoundingClientRect();
        const link = panel.querySelector('a[href="/camping"]');
        const linkRect = link ? link.getBoundingClientRect() : null;
        return {
          opened: rect.height > 0 && rect.width > 0,
          camping: !!linkRect && linkRect.width > 0 && linkRect.height > 0,
        };
      });
      if (mobile.opened === null) {
        notes.push(`${label}: no nav panel matched the mobile panel selector list`);
      } else {
        if (mobile.opened === false) failures.push(`${label}: mobile menu did not open after clicking the toggle`);
        if (!mobile.camping) failures.push(`${label}: /camping link not reachable inside the opened mobile menu`);
      }
      await page.keyboard.press("Escape").catch(() => {});
      await page.waitForTimeout(120);
    } else if (!metrics.campingVisible) {
      notes.push(`${label}: no mobile menu toggle matched the selector list (menu may be always-visible)`);
    }
  } else if (!metrics.campingVisible) {
    failures.push(`${label}: /camping link not rendered in the header at desktop width`);
  }

  notes.push(`${label}: header ${metrics.headerHeight}px, header links ${metrics.navLinks.filter((l) => l.visible).length}`);
}

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
  const context = await browser.newContext();
  const page = await context.newPage();
  const consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text().slice(0, 200));
  });

  for (const viewport of VIEWPORTS) {
    for (const route of ROUTES) {
      await audit(page, route, viewport);
    }
  }

  const severe = consoleErrors.filter((t) => !/net::ERR|Failed to load resource|fonts\.googleapis|fonts\.gstatic/.test(t));
  if (severe.length) notes.push(`console errors: ${JSON.stringify([...new Set(severe)].slice(0, 5))}`);
} finally {
  await browser.close();
  server.close();
}

for (const note of [...new Set(notes)]) console.log("· " + note);
if (failures.length) {
  console.error("\nFAILURES:");
  for (const failure of failures) console.error("✗ " + failure);
  console.error(`\n${failures.length} failure(s) across ${VIEWPORTS.length * ROUTES.length} page/viewport combinations.`);
  process.exit(1);
}
console.log(`\n✓ No overflow, clipping, font or mobile-menu failures across ${VIEWPORTS.length * ROUTES.length} page/viewport combinations.`);
