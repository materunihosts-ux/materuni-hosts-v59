import fs from "node:fs";
import path from "node:path";

const root = path.resolve("dist");
const errors = [];
const checks = [];
const fail = (message) => errors.push(message);
const pass = (message) => checks.push(message);

const relativeLuminance = (hex) => {
  const channels = hex.replace("#", "").match(/.{2}/g)?.map((value) => parseInt(value, 16) / 255);
  if (!channels || channels.length !== 3) return null;
  const linear = channels.map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
};
const contrastRatio = (foreground, background) => {
  const first = relativeLuminance(foreground);
  const second = relativeLuminance(background);
  if (first === null || second === null) return 0;
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
};

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

const groupDiscountPages = ["src/pages/experiences.astro", "src/pages/day-trips.astro", "src/pages/camping.astro"];
for (const sourcePath of groupDiscountPages) {
  const fullPath = path.resolve(sourcePath);
  if (!fs.existsSync(fullPath)) {
    fail(sourcePath + ": source file is missing for the group discount contrast check");
    continue;
  }
  const source = read(fullPath);
  const rule = source.match(/\.group-discount-heading\s+\.eyebrow\s*\{[^}]*color:\s*(#[0-9a-fA-F]{6})/i);
  if (!rule) {
    fail(sourcePath + ": group discount label must define a contrast-tested foreground color");
    continue;
  }
  const contrast = contrastRatio(rule[1], "#f4efe6");
  if (contrast < 4.5) fail(sourcePath + ": group discount label contrast is " + contrast.toFixed(2) + ":1 (requires 4.5:1)");
  else pass(sourcePath + ": group discount label contrast passes WCAG AA (" + contrast.toFixed(2) + ":1)");
}

const homeFile = routeFile("/");
if (homeFile) {
  const homeHtml = read(homeFile);
  if (!homeHtml.includes("https://www.facebook.com/share/1VTNWPbqcc/")) fail("Public homepage must include the current Materuni Hosts Facebook page link");
  else pass("Public homepage includes the current Materuni Hosts Facebook page link");
}

const layoutSourcePath = path.resolve("src/layouts/SiteLayout.astro");
const businessSchemaPath = path.resolve("src/components/LocalBusinessSchema.astro");
if (fs.existsSync(layoutSourcePath) && /15\s+oct(?:\.|obre)?\s+2026|15\.\s+Okt\.\s+2026|2[.,]640\s+TZS/i.test(read(layoutSourcePath))) fail("Multilingual fallback copy must not publish a stale TZS exchange-rate estimate");
else if (fs.existsSync(layoutSourcePath)) pass("Multilingual fallback copy avoids stale TZS exchange-rate estimates");
if (fs.existsSync(layoutSourcePath) && read(layoutSourcePath).includes('mailto:hello@materunihosts.com')) pass("Verified public email is present as a clickable footer contact");
else fail("Public footer must include the verified hello@materunihosts.com contact email");
if (fs.existsSync(layoutSourcePath) && read(layoutSourcePath).includes('"email": "hello@materunihosts.com"') && fs.existsSync(businessSchemaPath) && read(businessSchemaPath).includes('"email": "hello@materunihosts.com"')) pass("Verified email is present in TourOperator and LocalBusiness structured data");
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
const outdatedContactPages = sourceFiles.filter((file) => /materunihosts@gmail\.com/i.test(read(file)));
if (outdatedContactPages.length) fail("Public pages still contain the retired hello@materunihosts.com contact address: " + outdatedContactPages.map((file) => path.relative(process.cwd(), file)).join(", "));
else pass("Public pages contain no retired Gmail contact address");
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

// Cookie consent must gate analytics events and support withdrawal after opt-in.
const consentPath = path.resolve("src/components/CookieConsent.astro");
if (!fs.existsSync(consentPath)) fail("Cookie consent component is missing");
else {
  const consent = read(consentPath);
  if (!consent.includes("!saved?.analytics") || !consent.includes("!window.__materuniGtmLoaded")) fail("Analytics conversion events must be blocked before valid opt-in");
  else pass("Analytics conversion events are gated behind recorded opt-in");
  if (!/analytics_storage:\s*"denied"/.test(consent) || !/typeof window\.gtag === "function"/.test(consent)) fail("Cookie preference withdrawal must revoke Google analytics consent");
  else pass("Cookie preference withdrawal updates analytics consent to denied");
}

// Keep the guest concierge grounded in the live, active experience catalogue.
const conciergePath = path.resolve("supabase/functions/guest-concierge/index.ts");
if (!fs.existsSync(conciergePath)) fail("Guest concierge Edge Function source is missing");
else {
  const concierge = read(conciergePath);
  if (!/from\(["']experience_catalog["']\)[\s\S]*?select\(["']display_name, price_usd["']\)[\s\S]*?eq\(["']is_active["'],\s*true\)/.test(concierge)) {
    fail("Guest concierge must retrieve active experience names and prices from Supabase");
  } else pass("Guest concierge reads current active package prices from Supabase");
  if (!concierge.includes("liveSystemPrompt") || !concierge.includes("catalogueContext")) fail("Guest concierge AI prompt must include the live catalogue context");
  else pass("Guest concierge model prompt receives the live package catalogue");
  if (/From Bean to Cup|The Waterfall & Heritage Trail|The Materuni Signature Escape|\$65|\$75|\$85|\$110|\$135/.test(concierge)) {
    fail("Guest concierge contains retired package names or prices");
  } else pass("Guest concierge fallback no longer advertises retired package prices");
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
  const isRedirectRoute = relative === "about/index.html" || relative === "materuni-camping/index.html";
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


/* International standards source-level regression checks.
   These checks validate implementation intent, not external certification. */
const builtRobots = fs.existsSync(robotsPath) ? read(robotsPath) : "";
const robotLines = builtRobots.split(/\r?\n/);
for (const crawler of ["GPTBot", "Google-Extended", "CCBot", "anthropic-ai", "ClaudeBot", "Bytespider", "Meta-ExternalAgent"]) {
  const index = robotLines.findIndex((line) => /^User-agent:\s*/i.test(line) && line.split(":")[1].trim().toLowerCase() === crawler.toLowerCase());
  const nextGroup = robotLines.findIndex((line, lineIndex) => lineIndex > index && /^User-agent:\s*/i.test(line));
  const group = index >= 0 ? robotLines.slice(index, nextGroup >= 0 ? nextGroup : undefined).join("\n") : "";
  if (!/^Disallow:\s*\/\s*$/im.test(group)) fail("robots.txt must express the AI training-crawler preference for " + crawler);
}
if (builtRobots.includes("Sitemap: https://materunihosts.com/sitemap.xml")) pass("robots.txt advertises the canonical sitemap");
const securityTxt = path.join(root, ".well-known", "security.txt");
if (!fs.existsSync(securityTxt)) fail("Missing /.well-known/security.txt responsible disclosure contact");
else {
  const disclosure = read(securityTxt);
  if (!disclosure.includes("mailto:hello@materunihosts.com") || !disclosure.includes("Expires:") || !disclosure.includes("Canonical: https://materunihosts.com/.well-known/security.txt")) fail("security.txt must include a contact, expiry and canonical location");
  else pass("Responsible security disclosure contact is published");
}
const privacySourcePath = path.resolve("src/pages/privacy.astro");
if (fs.existsSync(privacySourcePath)) {
  const privacySource = read(privacySourcePath);
  if (!privacySource.includes("persistent Privacy settings control")) fail("Privacy policy must explain how to reopen and withdraw cookie consent");
  else pass("Privacy policy explains how visitors can reopen and change cookie preferences");
  for (const phrase of ["international transfers", "Your privacy rights", "do not sell personal information"]) {
    if (!privacySource.toLowerCase().includes(phrase.toLowerCase())) fail("Privacy policy is missing disclosure: " + phrase);
  }
}
const termsSourcePath = path.resolve("src/pages/terms.astro");
if (fs.existsSync(termsSourcePath) && /©\s*2026\s+Materuni Hosts/.test(read(termsSourcePath))) pass("Terms page includes a dated Materuni Hosts copyright notice");
else fail("Terms page must include the Materuni Hosts copyright notice");
const termsBody = fs.existsSync(termsSourcePath) ? read(termsSourcePath) : "";
for (const unsupportedClaim of ["guaranteed within 12 hours", "5% off for 4–5 guests", "20% deposit", "$25 per vehicle", "$50 per vehicle", "$80 per vehicle"]) {
  if (termsBody.includes(unsupportedClaim)) fail("Booking terms must not publish an unverified commercial promise: " + unsupportedClaim);
}
if (termsBody.includes("does not accept card payments") && termsBody.includes("Cancellation deadlines")) pass("Booking terms reflect enquiry-only payments and require written cancellation conditions");
const hostingConfigPath = path.resolve("vercel.json");
if (fs.existsSync(hostingConfigPath)) {
  const hostingConfig = read(hostingConfigPath);
  const requiredHeaders = ["Strict-Transport-Security", "X-Content-Type-Options", "X-Frame-Options", "Referrer-Policy", "Permissions-Policy"];
  for (const header of requiredHeaders) if (!hostingConfig.includes(header)) fail("Hosting header configuration is missing " + header);
  if (requiredHeaders.every((header) => hostingConfig.includes(header))) pass("Hosting configuration defines baseline browser security headers");
}

// Never ship AI Studio drafts, internal briefs or temporary media as public assets.
const internalPublicAssets = path.join(root, "assets", "aistudio");
const internalSourceAssets = path.resolve("public/assets/aistudio");
if (fs.existsSync(internalPublicAssets) && fs.readdirSync(internalPublicAssets).length) {
  fail("Build contains internal AI Studio drafts under /assets/aistudio");
} else pass("No internal AI Studio drafts are exposed in the public build");
if (fs.existsSync(internalSourceAssets) && fs.readdirSync(internalSourceAssets).length) {
  fail("Source contains files in public/assets/aistudio; internal drafts must stay outside public/");
} else pass("No internal AI Studio drafts remain in the public source directory");

// Keep all public pricing, estimates and transfer wording aligned with the live catalogue.
const catalogueSourcePath = path.resolve("src/pages/itinerary.astro");
const bookingSourcePath = path.resolve("src/pages/booking.astro");
const waterfallSourcePath = path.resolve("src/pages/materuni-waterfall-tour.astro");
const accommodationSourcePath = path.resolve("src/pages/accommodation.astro");
const adminFaqSourcePath = path.resolve("src/pages/admin/content.astro");
const catalogueSource = fs.existsSync(catalogueSourcePath) ? read(catalogueSourcePath) : "";
const expectedPublicPrices = [
  ['"name":"Materuni Waterfall & Chagga Village Experience","price":40', "waterfall $40"],
  ['"name":"Traditional Chagga Coffee Experience","price":36', "coffee $36"],
  ['"name":"Traditional Chagga Cooking Class","price":49', "cooking $49"],
  ['"name":"Materuni & Moshi Town Cultural Experience","price":52', "Moshi $52"],
  ['"name":"Materuni & Rau Forest Nature Experience","price":58', "Rau Forest $58"],
  ['"name":"Materuni Overnight Village Experience","price":90', "overnight $90"]
];
for (const [snippet, label] of expectedPublicPrices) {
  if (!catalogueSource.includes(snippet)) fail("Itinerary fallback catalogue is out of sync: " + label);
}
if (expectedPublicPrices.every(([snippet]) => catalogueSource.includes(snippet))) pass("Itinerary fallback prices match the six active Supabase catalogue prices");
for (const [sourcePath, label] of [
  [bookingSourcePath, "booking"],
  [waterfallSourcePath, "waterfall landing page"],
  [accommodationSourcePath, "accommodation"]
]) {
  if (!fs.existsSync(sourcePath)) { fail("Missing " + label + " source for pricing checks"); continue; }
  const source = read(sourcePath);
  if (/\$(?:25|50|80)\s*(?:\/\s*vehicle|per vehicle)/i.test(source)) fail(label + " must not publish unverified fixed transfer prices");
  if (/guaranteed within 12h|100% free with zero upfront deposit/i.test(source)) fail(label + " must not publish unverified response-time or payment promises");
}
if (fs.existsSync(bookingSourcePath) && /transferPrice\s*=|discount\s*=\s*guests>=/i.test(read(bookingSourcePath))) fail("Booking estimate must not calculate unverified transfer prices or fixed group-discount percentages");
else if (fs.existsSync(bookingSourcePath)) pass("Booking estimate requests host-confirmed transfer and group quotes instead of inventing prices");
if (fs.existsSync(waterfallSourcePath) && read(waterfallSourcePath).includes('"price": "40.00"')) pass("Waterfall structured-data offer matches the current $40 catalogue price");
else fail("Waterfall structured-data offer must match the current $40 catalogue price");
if (fs.existsSync(accommodationSourcePath) && read(accommodationSourcePath).includes("is $90 per person")) pass("Overnight accommodation copy matches the current $90 catalogue price");
else fail("Overnight accommodation copy must match the current $90 catalogue price");
if (fs.existsSync(adminFaqSourcePath) && /\(\$75\)|\(\$65\)|\(\$85\)|\(\$110\)|\(\$135\)/.test(read(adminFaqSourcePath))) fail("Admin FAQ defaults must not restore retired package prices");
else if (fs.existsSync(adminFaqSourcePath)) pass("Admin FAQ defaults no longer contain retired package prices");

if (errors.length) {
  console.error("\nQUALITY GATE FAILED");
  for (const error of errors) console.error(" - " + error);
  console.error("\nPassed checks: " + checks.length);
  process.exit(1);
}

console.log("QUALITY GATE PASSED");
for (const check of checks) console.log(" ✓ " + check);
