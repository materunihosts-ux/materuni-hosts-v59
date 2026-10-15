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
  "/", "/experiences", "/camping", "/day-trips", "/booking", "/itinerary", "/reviews", "/faq",
  "/sustainability", "/travel-guide", "/work-with-us", "/privacy", "/terms", "/itinerary", "/admin"
];
for (const route of expectedRoutes) {
  const file = routeFile(route);
  if (!file) fail("Missing built route: " + route);
  else pass("Built route: " + route);
}

for (const [route, source] of [["/camping", "source=camping"], ["/day-trips", "source=day-trips"]]) {
  const file = routeFile(route);
  if (file) {
    const html = read(file);
    if (!html.includes(source)) fail(route + ": booking links must preserve landing-page attribution");
    else pass(route + ": enquiry links preserve source attribution");
    if (!html.includes('application/ld+json')) fail(route + ": missing structured service/offer data");
    else pass(route + ": structured service/offer data is present");
  }
}

const homeFile = routeFile("/");
if (homeFile) {
  const homeHtml = read(homeFile);
  if (/facebook/i.test(homeHtml)) fail("Public homepage must not expose retired Facebook profile links or labels");
  else pass("Public homepage contains no retired Facebook profile reference");
}
const itineraryFile = routeFile("/itinerary");
if (itineraryFile) {
  const itineraryHtml = read(itineraryFile);
  if (!/Build Your Materuni Itinerary/i.test(itineraryHtml)) fail("Itinerary Builder route must retain its own page title");
  if (!/navigator\.share|share/i.test(itineraryHtml)) fail("Itinerary Builder must retain its sharing workflow");
  if (!/application\/pdf|\.pdf|PDF/i.test(itineraryHtml)) fail("Itinerary Builder must retain its PDF output workflow");
  if (/Build Your Materuni Itinerary/i.test(itineraryHtml) && /navigator\.share|share/i.test(itineraryHtml) && /application\/pdf|\.pdf|PDF/i.test(itineraryHtml)) pass("Itinerary Builder retains sharing and PDF output");
}
const bookingPage = routeFile("/booking");
if (bookingPage) {
  const assetDirectory = path.join(root, "_astro");
  const scripts = fs.existsSync(assetDirectory)
    ? fs.readdirSync(assetDirectory).filter((name) => name.endsWith(".js")).map((name) => read(path.join(assetDirectory, name))).join("\\n")
    : "";
  if (!scripts.includes("Enquiry source")) fail("Booking form must store landing-page enquiry attribution");
  else pass("Booking form includes landing-page attribution capture");
}
const analyticsPage = routeFile("/admin/analytics");
if (analyticsPage && !read(analyticsPage).includes("Where enquiries come from")) fail("Admin analytics must show landing-page enquiry sources");
else if (analyticsPage) pass("Admin analytics includes landing-page enquiry source reporting");

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

  const sitemapPaths = new Set(urls.map((url) => {
    const pathname = new URL(url).pathname;
    return pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
  }));
  for (const requiredPath of ["/", "/experiences", "/camping", "/day-trips", "/booking"]) {
    if (!sitemapPaths.has(requiredPath)) fail("Sitemap is missing an important public route: " + requiredPath);
  }
  if (sitemapPaths.has("/camping") && sitemapPaths.has("/day-trips")) {
    pass("Sitemap includes the flagship camping and day-trip landing pages");
  }
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
