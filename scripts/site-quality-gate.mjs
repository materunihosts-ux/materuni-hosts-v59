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
const homepageSourcePath = path.resolve("src/pages/index.astro");
if (fs.existsSync(homepageSourcePath)) {
  const homepageSource = read(homepageSourcePath);
  const homepageH1Count = [...homepageSource.matchAll(/<h1\b/g)].length;
  if (homepageH1Count !== 1) fail("Homepage source must contain exactly one primary H1");
  else pass("Homepage has exactly one primary H1");
  if (!homepageSource.includes('title="Materuni Village Tours & Chagga Experiences | Materuni Hosts"')) fail("Homepage title must target Materuni Village tours and Chagga experiences");
  else pass("Homepage title targets Materuni Village search intent");
  if (!homepageSource.includes('description="Visit Materuni Village near Moshi, Tanzania.')) fail("Homepage meta description must identify Materuni Village and its cultural experiences");
  else pass("Homepage meta description identifies Materuni Village and local experiences");
  if (homepageSource.includes("<iframe") || homepageSource.includes("map-embed-card") || !homepageSource.includes("materuni-map-svg")) fail("Homepage must use the accessible illustrated Materuni map, not an embedded map");
  else pass("Homepage uses an accessible illustrated Materuni village map");
  const cataloguePath = path.resolve("src/data/experiences.ts");
  const catalogueSource = fs.existsSync(cataloguePath) ? read(cataloguePath) : "";
  const requiredExperiences = [
    ["Materuni Waterfall & Chagga Village Experience", 40],
    ["Traditional Chagga Coffee Experience", 36],
    ["Traditional Chagga Cooking Class", 49],
    ["Materuni & Moshi Town Cultural Experience", 52],
    ["Materuni & Rau Forest Nature Experience", 58],
    ["Materuni Overnight Village Experience", 90]
  ];
  if (!homepageSource.includes('import { experienceItems } from "../data/experiences"') || !homepageSource.includes("experienceItems.map((item, index) =>")) fail("Homepage must render tour cards from the shared local experience catalogue");
  else pass("Homepage tour cards use the shared local experience catalogue");
  if (!catalogueSource || !requiredExperiences.every(([name, price]) => catalogueSource.includes('["' + name + '",' + price + ','))) fail("Local experience catalogue must contain all six verified experiences and published USD prices");
  else pass("Local experience catalogue contains all six verified experiences and published USD prices");
  if (!catalogueSource.includes("cooking_image/1792089297987-cooking-class.jpg") || catalogueSource.includes('["Traditional Chagga Cooking Class",49,"Cook, taste & share local food","coffee_image/')) fail("Cooking experience must use its cooking-class image, not a coffee photograph");
  else pass("Cooking experience uses its dedicated cooking-class image");
  if (/95-metre|95 metre|1,800 metres|No outsourced staff|fees go directly/i.test(homepageSource)) fail("Homepage contains unverified geographic or community-benefit claims");
  else pass("Homepage avoids unverified geographic and community-benefit claims");
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
const packingGuidePath = path.resolve("src/pages/journal/what-to-bring-on-materuni-waterfall-hike.astro");
if (fs.existsSync(packingGuidePath)) {
  const packingGuide = read(packingGuidePath);
  if (/95(?:-metre|m)|12[–-]15°C|1,700m|\\$45|Lead Mountain Host|purified refills/i.test(packingGuide)) fail("Materuni hike packing guide contains unverified measurements, outdated pricing or unsupported service claims");
  else pass("Materuni hike packing guide avoids unverified measurements and outdated claims");
  if (!packingGuide.includes("Book waterfall experience ($40)")) fail("Materuni hike guide CTA must match the published $40 experience price");
  else pass("Materuni hike guide CTA matches the published $40 experience price");
}
const reviewsSourcePath = path.resolve("src/pages/reviews.astro");
if (fs.existsSync(reviewsSourcePath)) {
  const reviewsSource = read(reviewsSourcePath);
  const reviewDataPath = path.resolve("src/data/google-reviews.ts");
  const reviewData = fs.existsSync(reviewDataPath) ? read(reviewDataPath) : "";
  const verifiedReviewers = ["Endika Unsuain", "Ariana Chalde Alvarez", "Dipesh Pabari"];
  if (!verifiedReviewers.every((name) => reviewData.includes(name))) fail("Shared review data must contain all three verified Google reviewers");
  else pass("Shared review data contains all three verified Google reviewers");
  if (!reviewsSource.includes('import { googleGuestReviews } from "../data/google-reviews"')) fail("Reviews page must use the shared verified Google review data");
  else pass("Reviews page uses the shared verified Google review data");
  const homepageSource = read(path.resolve("src/pages/index.astro"));
  if (!homepageSource.includes('import { googleGuestReviews } from "../data/google-reviews"') || !homepageSource.includes("{googleGuestReviews.map")) fail("Homepage must display the shared verified Google reviews");
  else pass("Homepage displays the shared verified Google reviews");
  if (!reviewsSource.includes("5.0 / 5") || !reviewsSource.includes("3 Google reviews") || !reviewsSource.includes("★★★★★")) fail("Reviews page must accurately label the current 5.0 average from three Google reviews");
  else pass("Reviews page rating and review count match the connected Google Business Profile");
  if (!reviewsSource.includes("https://g.page/r/CXy6M_Suiip9EBM/review") || !reviewsSource.includes("https://www.tripadvisor.com/34765809")) fail("Reviews page must link directly to the verified Google and TripAdvisor sources");
  else pass("Reviews page links directly to the verified Google and TripAdvisor sources");
  if (/supabase\.co\/storage|Waterfall%20Tours%20%26%20Village%20Camping/i.test(reviewsSource)) fail("Reviews page must avoid unavailable remote Supabase images and outdated business naming");
  else pass("Reviews page avoids unavailable Supabase media and uses the current business identity");
}
const accommodationSourcePath = path.resolve("src/pages/accommodation.astro");
if (fs.existsSync(accommodationSourcePath)) {
  const accommodationSource = read(accommodationSourcePath);
  if (/\\$101|\\$25 per vehicle|\\$50 per vehicle|\\$80 per vehicle|licensed drivers|14°C and 17°C|1,800m|3-inch|guaranteed within 12h/i.test(accommodationSource)) fail("Overnight page contains outdated pricing or unverified accommodation/transfer claims");
  else pass("Overnight page avoids outdated prices and unverified facilities or transfer claims");
  if (!accommodationSource.includes('"price": "90.00"') || !accommodationSource.includes("USD $90 per person") || !accommodationSource.includes("provide a separate quote")) fail("Overnight page must use the published $90 USD price and quote transport separately");
  else pass("Overnight page matches the published $90 USD price and separate-transfer policy");
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
  const imageTags = [...html.matchAll(/<img\b[^>]*>/gi)].map((match) => match[0]);
  for (const image of imageTags) {
    if (!/\balt\s*=\s*["'][^"']*["']/i.test(image)) {
      fail(relative + ": image is missing an alt attribute");
      break;
    }
  }
  if (/href\s*=\s*["'][^"']*REPLACE_/i.test(html)) fail(relative + ": contains a placeholder URL in href");
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
