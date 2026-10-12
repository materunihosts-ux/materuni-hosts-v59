import fs from "node:fs";
import path from "node:path";

const root = path.resolve("dist");
const errors = [];
const checks = [];
const fail = (message) => errors.push(message);
const pass = (message) => checks.push(message);

if (!fs.existsSync(root)) {
  console.error("QUALITY GATE FAILED: dist/ does not exist. Run astro build first.");
  process.exit(1);
}

const read = (file) => fs.readFileSync(file, "utf8");
const routeFile = (pathname) => {
  const clean = decodeURIComponent(pathname.split("?")[0].split("#")[0]);
  const relative = clean.replace(/^\/+|\/+$/g, "");
  const candidates = clean === "/"
    ? [path.join(root, "index.html")]
    : [
        path.join(root, relative, "index.html"),
        path.join(root, relative + ".html"),
        path.join(root, relative)
      ];
  return candidates.find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
};

const sitemapPath = path.join(root, "sitemap.xml");
const robotsPath = path.join(root, "robots.txt");
if (!fs.existsSync(sitemapPath)) fail("Missing dist/sitemap.xml");
else pass("Sitemap is present");
if (!fs.existsSync(robotsPath)) fail("Missing dist/robots.txt");
else {
  const robots = read(robotsPath);
  if (!/Disallow:\s*\/admin\//i.test(robots)) fail("robots.txt must disallow /admin/");
  else pass("Private admin route is excluded in robots.txt");
}

const expectedRoutes = [
  "/", "/experiences", "/booking", "/itinerary", "/reviews", "/faq",
  "/sustainability", "/travel-guide", "/work-with-us", "/privacy", "/terms", "/admin"
];
for (const route of expectedRoutes) {
  const file = routeFile(route);
  if (!file) fail("Missing built route: " + route);
  else pass("Built route: " + route);
}

if (fs.existsSync(sitemapPath)) {
  const sitemap = read(sitemapPath);
  if (/\/admin\/?(?:<|$)/i.test(sitemap)) fail("Private admin route must not appear in sitemap.xml");
  const urls = [...sitemap.matchAll(/<loc>\s*(https?:\/\/[^<]+)\s*<\/loc>/gi)].map((match) => match[1].trim());
  if (!urls.length) fail("Sitemap contains no loc URLs");
  for (const url of urls) {
    let pathname;
    try { pathname = new URL(url).pathname; }
    catch { fail("Invalid sitemap URL: " + url); continue; }
    if (!routeFile(pathname)) fail("Sitemap route has no built HTML page: " + pathname);
  }
  if (urls.length) pass("All " + urls.length + " sitemap URLs resolve to built pages");
}

const htmlFiles = [];
const walk = (directory) => {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.isFile() && entry.name.endsWith(".html")) htmlFiles.push(full);
  }
};
walk(root);

for (const file of htmlFiles) {
  const html = read(file);
  const relative = path.relative(root, file);
  if (!/<title>\s*[^<]+<\/title>/i.test(html)) fail(relative + ": missing page title");
  if (!/<meta\s+name=["']description["']\s+content=["'][^"']+["']/i.test(html)) fail(relative + ": missing meta description");
  if (!/<link\s+rel=["']canonical["']\s+href=["']https:\/\//i.test(html)) fail(relative + ": missing canonical URL");
  if (!/<html\b[^>]*\blang=["'][a-z]{2}/i.test(html)) fail(relative + ": missing document language");
  if (/<h1\b/gi.test(html) === false) fail(relative + ": missing primary heading");
  const imageTags = [...html.matchAll(/<img\b[^>]*>/gi)].map((match) => match[0]);
  for (const image of imageTags) {
    if (!/\balt\s*=\s*["'][^"']*["']/i.test(image)) {
      fail(relative + ": image is missing an alt attribute");
      break;
    }
  }
  if (/href\s*=\s*["'][^"']*REPLACE_/i.test(html)) fail(relative + ": contains a placeholder URL in href");
}
if (htmlFiles.length) pass("Checked SEO metadata and primary headings on " + htmlFiles.length + " HTML pages");

const adminFile = routeFile("/admin");
if (adminFile && !/<meta\s+name=["']robots["']\s+content=["']noindex,nofollow["']/i.test(read(adminFile))) {
  fail("Admin dashboard must render noindex,nofollow");
} else if (adminFile) pass("Admin dashboard renders noindex,nofollow");

const internalLinks = new Set();
for (const file of htmlFiles) {
  const html = read(file);
  for (const match of html.matchAll(/\bhref\s*=\s*["']([^"']+)["']/gi)) {
    const href = match[1].trim();
    if (!href.startsWith("/") || href.startsWith("//")) continue;
    const pathname = href.split("?")[0].split("#")[0] || "/";
    if (pathname.startsWith("/_astro/")) continue;
    internalLinks.add(pathname);
  }
}
for (const pathname of internalLinks) {
  if (!routeFile(pathname) && !fs.existsSync(path.join(root, pathname.replace(/^\//, "")))) {
    fail("Broken internal href: " + pathname);
  }
}
if (internalLinks.size) pass("Checked " + internalLinks.size + " unique internal href targets");

if (errors.length) {
  console.error("\nQUALITY GATE FAILED");
  for (const error of errors) console.error(" - " + error);
  console.error("\nPassed checks: " + checks.length);
  process.exit(1);
}

console.log("QUALITY GATE PASSED");
for (const check of checks) console.log(" ✓ " + check);
