const ALLOWED_SOURCES = new Set(["csv_import", "manual", "gsc_export", "browser_live_crawl"]);
const VALID_INTENTS = new Set(["informational", "commercial", "transactional", "navigational"]);

function safeCount(value) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function normalizeOrigin(value) {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.origin : null;
  } catch {
    return null;
  }
}

/**
 * Creates a read-only, source-labelled SEO view from existing keyword rows and
 * browser crawl snapshots. It does not imply that imported CSVs are API-verified
 * or that crawl observations represent Google rankings.
 */
export function buildSeoIntelligenceModel({ keywords = [], snapshots = [], siteOrigin } = {}) {
  const origin = normalizeOrigin(siteOrigin);
  if (!origin) throw new TypeError("A valid HTTP(S) siteOrigin is required");
  const normalizedKeywords = [];
  const seenKeywords = new Set();

  for (const row of Array.isArray(keywords) ? keywords : []) {
    const keyword = String(row?.keyword ?? "").trim();
    if (!keyword) continue;
    const key = keyword.toLocaleLowerCase();
    if (seenKeywords.has(key)) continue;
    seenKeywords.add(key);
    const source = ALLOWED_SOURCES.has(row.source) ? row.source : "manual";
    const intent = VALID_INTENTS.has(row.intent) ? row.intent : "informational";
    let targetUrl = null;
    if (row.target_url) {
      try {
        const parsed = new URL(row.target_url, origin);
        if (parsed.origin === origin && ["http:", "https:"].includes(parsed.protocol)) {
          targetUrl = parsed.origin + parsed.pathname + parsed.search;
        }
      } catch { /* Invalid target URLs are omitted from the intelligence view. */ }
    }
    normalizedKeywords.push({
      keyword,
      normalizedKeyword: key,
      intent,
      targetUrl,
      source,
      provenance: source === "csv_import" ? "user_supplied_csv_unverified"
        : source === "gsc_export" ? "provider_export_not_api_verified"
        : source === "browser_live_crawl" ? "browser_observation" : "manually_entered",
      searchVolume: row.search_volume == null ? null : safeCount(row.search_volume),
      difficulty: row.difficulty == null ? null : Math.min(100, safeCount(row.difficulty)),
      position: row.current_position == null ? null : safeCount(row.current_position),
      clicks: safeCount(row.clicks),
      impressions: safeCount(row.impressions),
      status: String(row.status ?? "research")
    });
  }

  const normalizedPages = [];
  const seenPages = new Set();
  for (const snapshot of Array.isArray(snapshots) ? snapshots : []) {
    if (snapshot?.schemaVersion !== 1 || snapshot?.source !== "browser_live_crawl" ||
        normalizeOrigin(snapshot.siteOrigin) !== origin || !Array.isArray(snapshot.pages)) continue;
    for (const page of snapshot.pages) {
      const path = typeof page?.path === "string" && page.path.startsWith("/") && !page.path.startsWith("//")
        ? page.path : null;
      if (!path) continue;
      const key = path;
      const stamp = String(snapshot.capturedAt ?? "");
      const existing = normalizedPages.findIndex((item) => item.path === key);
      const observation = {
        path,
        url: origin + path,
        status: Number.isInteger(page.status) ? page.status : null,
        title: String(page.title ?? ""),
        description: String(page.description ?? ""),
        h1Count: safeCount(page.h1Count),
        hasViewport: Boolean(page.hasViewport),
        findings: Array.isArray(page.findings) ? page.findings.map(String) : [],
        observedAt: stamp,
        source: "browser_live_crawl",
        provenance: "browser_live_crawl_not_search_performance"
      };
      if (existing < 0) {
        seenPages.add(key);
        normalizedPages.push(observation);
      } else if (stamp > normalizedPages[existing].observedAt) {
        normalizedPages[existing] = observation;
      }
    }
  }

  const recommendations = [];
  for (const page of normalizedPages) {
    const add = (code, severity, action, evidence) =>
      recommendations.push({ id: code + ":" + page.path, code, severity, action, page: page.url, evidence, source: "browser_live_crawl" });
    if (page.status != null && page.status >= 400) add("http_error", "high", "Resolve the HTTP error or update internal links.", "Observed HTTP " + page.status);
    if (!page.title.trim()) add("missing_title", "high", "Add a unique, descriptive page title.", "The crawl found no title text.");
    if (!page.description.trim()) add("missing_description", "medium", "Write a useful page-specific meta description.", "The crawl found no meta description.");
    if (!page.hasViewport) add("missing_viewport", "high", "Add a responsive viewport declaration.", "The crawl did not detect a mobile viewport.");
    if (page.h1Count === 0) add("missing_h1", "medium", "Add one clear primary page heading.", "The crawl detected zero H1 headings.");
    if (page.h1Count > 1) add("multiple_h1", "low", "Review heading hierarchy and keep one primary H1 where appropriate.", "The crawl detected " + page.h1Count + " H1 headings.");
    for (const finding of page.findings) {
      if (/canonical/i.test(finding)) add("canonical_review", "medium", "Review the canonical URL and ensure it points to the preferred same-site page.", finding);
    }
  }

  const impressions = normalizedKeywords.reduce((sum, row) => sum + row.impressions, 0);
  const clicks = normalizedKeywords.reduce((sum, row) => sum + row.clicks, 0);
  return {
    schemaVersion: 1,
    siteOrigin: origin,
    generatedAt: new Date().toISOString(),
    dataSources: {
      keywords: [...new Set(normalizedKeywords.map((row) => row.provenance))],
      pages: normalizedPages.length ? ["browser_live_crawl"] : [],
      warning: "Imported keyword metrics are user-supplied and not independently API-verified. Browser crawls do not measure Google rankings, organic traffic, backlinks or indexing."
    },
    summary: {
      keywordCount: normalizedKeywords.length,
      crawlPageCount: normalizedPages.length,
      recommendationCount: recommendations.length,
      keywordClicks: clicks,
      keywordImpressions: impressions,
      keywordCtr: impressions > 0 ? clicks / impressions : null
    },
    keywords: normalizedKeywords,
    pages: normalizedPages,
    recommendations: recommendations.sort((a, b) => ({ high: 0, medium: 1, low: 2 }[a.severity] - ({ high: 0, medium: 1, low: 2 }[b.severity])))
  };
}
