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
  "/sustainability", "/travel-guide", "/work-with-us", "/privacy", "/terms", "/admin"
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
  if (!homeHtml.includes("https://www.facebook.com/share/1VTNWPbqcc/")) fail("Public homepage must include the current Materuni Hosts Facebook page link");
  else pass("Public homepage includes the current Materuni Hosts Facebook page link");
}

const layoutSourcePath = path.resolve("src/layouts/SiteLayout.astro");
const businessSchemaPath = path.resolve("src/components/LocalBusinessSchema.astro");
if (fs.existsSync(layoutSourcePath) && read(layoutSourcePath).includes('mailto:materunihosts@gmail.com')) pass("Verified public email is present as a clickable footer contact");
else fail("Public footer must include the verified materunihosts@gmail.com contact email");
if (fs.existsSync(layoutSourcePath) && read(layoutSourcePath).includes('"email": "materunihosts@gmail.com"') && fs.existsSync(businessSchemaPath) && read(businessSchemaPath).includes('"email": "materunihosts@gmail.com"')) pass("Verified email is present in TourOperator and LocalBusiness structured data");
else fail("Verified email must be present in both public business structured-data sources");

const aboutUsFile = routeFile("/about-us");
if (aboutUsFile) {
  const aboutHtml = read(aboutUsFile);
  if (!aboutHtml.includes("https://materunihosts.com/about-us")) fail("About Us must use /about-us as its canonical URL");
  if (!aboutHtml.includes("Saidi Materu")) fail("About Us must retain the verified founder name Saidi Materu");
  if (aboutHtml.includes("https://materunihosts.com/about-us") && aboutHtml.includes("Saidi Materu")) pass("About Us canonical URL and founder story are present");
}
for (const route of ["/", "/experiences", "/day-trips"]) {
  const file = routeFile(route);
  if (!file) continue;
  const html = read(file);
  if (/cooking_image|materuni-cooking|photo-1723643343026/i.test(html)) fail(route + ": cooking-class photography must remain removed");
  else pass(route + ": cooking-class photography remains removed");
}
const itineraryFile = routeFile("/itinerary");
if (itineraryFile) {
  const itineraryHtml = read(itineraryFile);
  const itinerarySourcePath = path.resolve("src/pages/itinerary.astro");
  const itinerarySource = fs.existsSync(itinerarySourcePath) ? read(itinerarySourcePath) : "";
  if (!/<title>[^<]*Materuni Itinerary[^<]*<\/title>/i.test(itineraryHtml)) fail("Itinerary Builder route must retain its own SEO title");
  if (!/navigator\.share|navigator\[['"]share['"]\]/i.test(itinerarySource)) fail("Itinerary Builder source must retain its native share workflow");
  if (!/application\/pdf|\.pdf|PDF/i.test(itinerarySource)) fail("Itinerary Builder source must retain its PDF output workflow");
  if (/<title>[^<]*Materuni Itinerary[^<]*<\/title>/i.test(itineraryHtml) && /navigator\.share|navigator\[['"]share['"]\]/i.test(itinerarySource) && /application\/pdf|\.pdf|PDF/i.test(itinerarySource)) pass("Itinerary Builder retains SEO title, source-level sharing and PDF output");
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


const publicSourceRoot = path.resolve("src/pages");
const sourceFiles = [];
const walkSources = (directory) => {
  if (!fs.existsSync(directory)) return;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "admin") walkSources(full);
    } else if (entry.isFile() && entry.name.endsWith(".astro")) sourceFiles.push(full);
  }
};
walkSources(publicSourceRoot);
let checkedImages = 0;
for (const file of sourceFiles) {
  const source = read(file);
  const images = [...source.matchAll(/<img\b[^>]*>/gis)].map((match) => match[0]);
  for (const image of images) {
    checkedImages++;
    const relative = path.relative(process.cwd(), file);
    if (!/\balt\s*=/i.test(image)) fail(relative + ": public image is missing alt text");
    if (!/\bwidth\s*=/.test(image) || !/\bheight\s*=/.test(image)) fail(relative + ": public image needs width and height to reduce layout shift");
    if (!/\bloading\s*=\s*["'](?:lazy|eager)["']/i.test(image)) fail(relative + ": public image needs an explicit loading strategy");
    if (!/\bdecoding\s*=\s*["'](?:async|sync|auto)["']/i.test(image)) fail(relative + ": public image needs an explicit decoding strategy");
  }
}
if (checkedImages) pass("Checked alt text, dimensions and loading/decoding hints on " + checkedImages + " public source images");

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
  const isRedirectRoute = relative === "about/index.html";
  if (isRedirectRoute) {
    if (!/http-equiv/i.test(html) || !/refresh/i.test(html)) fail(relative + ": legacy About URL must redirect to /about-us");
    else pass(relative + ": legacy About URL redirects to the canonical About Us page");
    continue;
  }
  if (!/<title>\s*[^<]+<\/title>/i.test(html)) fail(relative + ": missing page title");
  if (!/<meta\s+name=["']description["']\s+content=["'][^"']+["']/i.test(html)) fail(relative + ": missing meta description");
  if (!/<link\s+rel=["']canonical["']\s+href=["']https:\/\//i.test(html)) fail(relative + ": missing canonical URL");
  if (!/<html\b[^>]*\blang=["'][a-z]{2}/i.test(html)) fail(relative + ": missing document language");
  if (/<h1\b/gi.test(html) === false) fail(relative + ": missing primary heading");
  const isPrivateRoute = relative.startsWith("admin/") || relative === "admin.html";
  const isNotFoundRoute = relative === "404.html";
  if (!isPrivateRoute && !isNotFoundRoute && /<meta\s+name=["']robots["']\s+content=["'][^"']*noindex/i.test(html)) fail(relative + ": public page must remain indexable");
  if (!isPrivateRoute && !isNotFoundRoute) {
    const anchors = [...html.matchAll(/<a\b[^>]*>/gi)].map((match) => match[0]);
    for (const anchor of anchors) {
      if (!/\bhref\s*=\s*["'][^"']+["']/i.test(anchor)) {
        fail(relative + ": public link is missing a crawlable href");
        break;
      }
      if (/\bhref\s*=\s*["']\s*(?:javascript:|#\s*["'])/i.test(anchor)) {
        fail(relative + ": public link has a non-crawlable destination");
        break;
      }
    }
  }
  const optimizedImageRoutes = ["/", "/experiences", "/camping", "/day-trips", "/sustainability"];
for (const route of optimizedImageRoutes) {
  const optimizedFile = routeFile(route);
  if (optimizedFile) {
    const optimizedHtml = read(optimizedFile);
    const renderedImages = [...optimizedHtml.matchAll(/<img\b[^>]*>/gi)].map((match) => match[0]);
    if (renderedImages.some((image) => /storage\/v1\/object\/public\/materuni-images/i.test(image))) fail(route + ": visible photography must use optimized local build assets");
    else if (renderedImages.length) pass(route + ": visible photography is served from optimized build assets");
  }
}
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

const notFoundPage = path.join(root, "404.html");
if (!fs.existsSync(notFoundPage)) fail("Missing branded 404.html page");
else {
  const notFoundHtml = read(notFoundPage);
  if (!/<meta\s+name=["']robots["']\s+content=["']noindex,nofollow["']/i.test(notFoundHtml)) fail("404 page must render noindex,nofollow");
  else pass("Branded 404 page exists and is excluded from search indexing");
}

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
