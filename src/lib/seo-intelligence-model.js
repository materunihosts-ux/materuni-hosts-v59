const ALLOWED_SOURCES = new Set(["csv_import", "manual", "gsc_export", "browser_live_crawl"]);
const VALID_INTENTS = new Set(["informational", "commercial", "transactional", "navigational"]);
const SEVERITY_ORDER = { high: 0, medium: 1, low: 2 };

function safeCount(value) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}
function normalizeOrigin(value) {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.origin : null;
  } catch { return null; }
}
function normalizePath(value) {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) return null;
  try {
    const url = new URL(value, "https://materuni.invalid");
    return url.origin === "https://materuni.invalid" ? (url.pathname === "/" ? "/" : (url.pathname.endsWith("/") && url.pathname.length > 1 ? url.pathname.slice(0, -1) : url.pathname)) : null;
  } catch { return null; }
}
function cleanText(value, max = 1000) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

/**
 * Read-only SEO model. Imported metrics remain explicitly unverified; crawl
 * observations are technical signals, never Google search-performance data.
 */
export function buildSeoIntelligenceModel({ keywords = [], snapshots = [], siteOrigin } = {}) {
  const origin = normalizeOrigin(siteOrigin);
  if (!origin) throw new TypeError("A valid HTTP(S) siteOrigin is required");

  const normalizedKeywords = [];
  const keywordByKey = new Map();
  for (const row of Array.isArray(keywords) ? keywords : []) {
    const keyword = cleanText(row?.keyword, 300);
    if (!keyword) continue;
    const key = keyword.toLocaleLowerCase();
    if (keywordByKey.has(key)) continue;
    const source = ALLOWED_SOURCES.has(row.source) ? row.source : "manual";
    const intent = VALID_INTENTS.has(row.intent) ? row.intent : "informational";
    let targetUrl = null, targetPath = null;
    if (row.target_url) {
      try {
        const parsed = new URL(row.target_url, origin);
        if (parsed.origin === origin && ["http:", "https:"].includes(parsed.protocol) && !parsed.username && !parsed.password) {
          targetUrl = parsed.origin + parsed.pathname + parsed.search;
          targetPath = parsed.pathname === "/" ? "/" : (parsed.pathname.endsWith("/") && parsed.pathname.length > 1 ? parsed.pathname.slice(0, -1) : parsed.pathname);
        }
      } catch { /* Unsafe target URLs are deliberately omitted. */ }
    }
    const record = {
      keyword, normalizedKeyword: key, intent, targetUrl, targetPath, source,
      provenance: source === "csv_import" ? "user_supplied_csv_unverified"
        : source === "gsc_export" ? "provider_export_not_api_verified"
        : source === "browser_live_crawl" ? "browser_observation" : "manually_entered",
      searchVolume: row.search_volume == null ? null : safeCount(row.search_volume),
      difficulty: row.difficulty == null ? null : Math.min(100, safeCount(row.difficulty)),
      position: row.current_position == null ? null : safeCount(row.current_position),
      clicks: safeCount(row.clicks), impressions: safeCount(row.impressions),
      status: cleanText(row.status || "research", 40)
    };
    normalizedKeywords.push(record);
    keywordByKey.set(key, record);
  }

  const pagesByPath = new Map();
  for (const snapshot of Array.isArray(snapshots) ? snapshots : []) {
    if (snapshot?.schemaVersion !== 1 || snapshot?.source !== "browser_live_crawl" ||
        normalizeOrigin(snapshot.siteOrigin) !== origin || !Array.isArray(snapshot.pages)) continue;
    const stampValue = Date.parse(snapshot.capturedAt || "");
    const stamp = Number.isFinite(stampValue) ? stampValue : 0;
    for (const page of snapshot.pages) {
      const path = normalizePath(page?.path);
      if (!path) continue;
      const old = pagesByPath.get(path);
      if (old && old._stamp > stamp) continue;
      pagesByPath.set(path, {
        path, url: origin + path,
        status: Number.isInteger(page.status) ? page.status : null,
        title: cleanText(page.title, 300), description: cleanText(page.description, 500),
        h1Count: safeCount(page.h1Count), hasViewport: Boolean(page.hasViewport),
        canonicalUrl: cleanText(page.canonicalUrl, 1000),
        robots: cleanText(page.robots, 200), openGraphTitle: cleanText(page.openGraphTitle, 300),
        imagesMissingAlt: safeCount(page.imagesMissingAlt),
        wordCount: Number.isInteger(page.wordCount) && page.wordCount >= 0 ? page.wordCount : null,
        internalLinkCount: Number.isInteger(page.internalLinkCount) && page.internalLinkCount >= 0 ? page.internalLinkCount : null,
        imageCount: Number.isInteger(page.imageCount) && page.imageCount >= 0 ? page.imageCount : null,
        findings: Array.isArray(page.findings) ? page.findings.map((v) => cleanText(v, 300)).filter(Boolean) : [],
        observedAt: snapshot.capturedAt || null, _stamp: stamp,
        source: "browser_live_crawl", provenance: "browser_live_crawl_not_search_performance"
      });
    }
  }

  const pages = [...pagesByPath.values()].map(({ _stamp, ...page }) => page);
  const pageByPath = new Map(pages.map((page) => [page.path, page]));
  const recommendations = [];
  const add = (code, severity, action, page, evidence) => recommendations.push({
    id: code + ":" + page.path, code, severity, action, page: page.url, evidence,
    source: "browser_live_crawl"
  });

  for (const page of pages) {
    if (page.status != null && page.status >= 400) add("http_error", "high", "Resolve the HTTP error or update internal links.", page, "Observed HTTP " + page.status);
    if (!page.title) add("missing_title", "high", "Add a unique, descriptive page title.", page, "The crawl found no title text.");
    else if (page.title.length < 30 || page.title.length > 60) add("title_length", "low", "Review title length for clarity and search-result readability; length is a guideline, not a ranking rule.", page, "Observed " + page.title.length + " characters.");
    if (!page.description) add("missing_description", "medium", "Write a useful, page-specific meta description.", page, "The crawl found no meta description.");
    else if (page.description.length < 120 || page.description.length > 160) add("description_length", "low", "Review the meta description for a concise, complete search snippet; Google may rewrite snippets.", page, "Observed " + page.description.length + " characters.");
    if (!page.hasViewport) add("missing_viewport", "high", "Add a responsive viewport declaration.", page, "The crawl did not detect a mobile viewport.");
    if (!page.canonicalUrl) add("missing_canonical", "medium", "Add a correct canonical URL for the preferred version of this page.", page, "The crawl did not find a canonical link.");\n    if (!page.openGraphTitle) add("missing_open_graph_title", "low", "Add an Open Graph title so shared links have a useful page-specific heading.", page, "The crawl did not find og:title.");\n    if (page.h1Count === 0) add("missing_h1", "medium", "Add a clear primary page heading.", page, "The crawl detected zero H1 headings.");
    if (page.h1Count > 1) add("multiple_h1", "low", "Review heading hierarchy; multiple H1s are not automatically a penalty.", page, "The crawl detected " + page.h1Count + " H1 headings.");
    if (page.robots.includes("noindex")) add("noindex", "high", "Confirm whether this page should be excluded from search; remove noindex only if it is intended to rank.", page, "Robots meta contains noindex.");
    if (page.imagesMissingAlt > 0) add("missing_image_alt", "medium", "Write concise, meaningful alt text for informative images; use empty alt for decorative images.", page, page.imagesMissingAlt + " of " + (page.imageCount ?? "unknown") + " images lack alt text.");
    if (page.wordCount != null && page.wordCount < 300) add("thin_content_review", "medium", "Review whether the main content fully answers visitor questions. The 300-word threshold is only a triage heuristic, not a Google rule.", page, "Crawler counted " + page.wordCount + " words in main content.");
    if (page.internalLinkCount === 0) add("no_internal_links", "medium", "Add relevant contextual links to related Materuni experiences, travel guidance or booking information.", page, "No same-site links to a different path were detected.");
    if (page.canonicalUrl) {
      try {
        const canonical = new URL(page.canonicalUrl, origin);
        if (canonical.origin !== origin) add("external_canonical", "high", "Review the canonical URL; use a same-site canonical unless an intentional cross-domain canonical is required.", page, page.canonicalUrl);
        else if ((canonical.pathname + canonical.search) !== page.path) add("canonical_mismatch", "medium", "Check that the canonical points to the intended preferred URL and that the page is not accidentally canonicalised elsewhere.", page, "Observed canonical: " + canonical.pathname + canonical.search);
      } catch { add("invalid_canonical", "medium", "Repair the malformed canonical URL.", page, page.canonicalUrl); }
    }
  }

  const duplicateGroups = (field) => {
    const groups = new Map();
    for (const page of pages) {
      const value = page[field].toLocaleLowerCase();
      if (!value) continue;
      const list = groups.get(value) || [];
      list.push(page);
      groups.set(value, list);
    }
    return [...groups.values()].filter((group) => group.length > 1);
  };
  for (const group of duplicateGroups("title")) {
    for (const page of group) add("duplicate_title", "medium", "Give this page a distinct title that describes its unique purpose.", page, "Same title also appears on: " + group.filter((p) => p.path !== page.path).map((p) => p.path).join(", "));
  }
  for (const group of duplicateGroups("description")) {
    for (const page of group) add("duplicate_description", "low", "Write a distinct meta description that accurately summarises this page.", page, "Same description also appears on: " + group.filter((p) => p.path !== page.path).map((p) => p.path).join(", "));
  }

  const targetCounts = new Map();
  for (const keyword of normalizedKeywords) {
    if (!keyword.targetPath) continue;
    const paths = targetCounts.get(keyword.targetPath) || [];
    paths.push(keyword.keyword);
    targetCounts.set(keyword.targetPath, paths);
    if (!pageByPath.has(keyword.targetPath)) {
      recommendations.push({ id: "keyword_target_not_crawled:" + keyword.normalizedKeyword, code: "keyword_target_not_crawled", severity: "low", action: "Check that the target URL is live and included in the current crawl scope.", page: keyword.targetUrl, evidence: "Keyword target was not present in this crawl snapshot; this does not prove the URL is broken.", source: keyword.provenance });
    }
  }
  for (const [path, list] of targetCounts) {
    if (list.length > 1) {
      const page = pageByPath.get(path);
      if (page) add("multiple_keywords_same_target", "low", "Review whether these keywords share one search intent or need separate, genuinely useful landing pages.", page, "Mapped keywords: " + list.join("; "));
    }
  }
  const targetedPaths = new Set(targetCounts.keys());
  for (const page of pages) {
    if (page.path !== "/" && !targetedPaths.has(page.path)) {
      add("no_keyword_mapping", "low", "Review the page's search purpose and map one relevant primary keyword if it serves an organic-search need.", page, "No keyword record currently targets this crawled path; not proof of poor rankings.");
    }
  }

  const impressions = normalizedKeywords.reduce((sum, row) => sum + row.impressions, 0);
  const clicks = normalizedKeywords.reduce((sum, row) => sum + row.clicks, 0);
  const severityCounts = recommendations.reduce((acc, item) => { acc[item.severity]++; return acc; }, { high: 0, medium: 0, low: 0 });
  return {
    schemaVersion: 1, siteOrigin: origin, generatedAt: new Date().toISOString(),
    dataSources: {
      keywords: [...new Set(normalizedKeywords.map((row) => row.provenance))],
      pages: pages.length ? ["browser_live_crawl"] : [],
      warning: "Imported keyword metrics are user-supplied and not independently API-verified. Browser crawls do not measure Google rankings, organic traffic, backlinks or indexing. Word-count thresholds are review heuristics, not ranking rules."
    },
    summary: {
      keywordCount: normalizedKeywords.length, crawlPageCount: pages.length,
      recommendationCount: recommendations.length, highPriority: severityCounts.high,
      mediumPriority: severityCounts.medium, lowPriority: severityCounts.low,
      keywordClicks: clicks, keywordImpressions: impressions,
      keywordCtr: impressions > 0 ? clicks / impressions : null
    },
    keywords: normalizedKeywords, pages,
    recommendations: recommendations.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || a.page.localeCompare(b.page) || a.code.localeCompare(b.code))
  };
}
