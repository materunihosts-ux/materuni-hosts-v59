const DEFAULT_MAX_URLS = 150;

export function isSameOriginUrl(value, origin) {
  try {
    return new URL(value, origin).origin === new URL(origin).origin;
  } catch {
    return false;
  }
}

export function extractSitemapPaths(xmlText, origin, maxUrls = DEFAULT_MAX_URLS) {
  if (typeof xmlText !== "string" || !xmlText.trim()) return [];
  const safeLimit = Number.isInteger(maxUrls) ? Math.max(0, Math.min(maxUrls, 1000)) : DEFAULT_MAX_URLS;
  if (safeLimit === 0) return [];
  const matches = xmlText.matchAll(/<loc(?:\s[^>]*)?>([\s\S]*?)<\/loc>/gi);
  const paths = new Set();
  for (const match of matches) {
    const raw = match[1].replace(/&amp;/g, "&").trim();
    if (!raw) continue;
    try {
      const url = new URL(raw);
      if (!isSameOriginUrl(url.href, origin)) continue;
      if (!["http:", "https:"].includes(url.protocol)) continue;
      paths.add(url.pathname);
    } catch {
      // Ignore malformed sitemap entries rather than failing the entire audit.
    }
    if (paths.size >= safeLimit) break;
  }
  return [...paths];
}

function safeCsvValue(value) {
  let text = String(value ?? "");
  // Prevent spreadsheet formula execution when an audit is opened in Excel/Sheets.
  if (/^[\u0000-\u0020]*[=+@-]/.test(text)) text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
}

export function buildAuditCsv(results) {
  const headings = ["Page", "HTTP status", "Title", "Description", "H1 count", "Canonical URL", "Robots", "Mobile viewport", "Open Graph title", "Images missing alt", "Findings"];
  const rows = [
    headings,
    ...(Array.isArray(results) ? results : []).map((r) => [
      r.path, r.status, r.title, r.desc, r.h1, r.canonical, r.robots,
      r.viewport, r.ogTitle, r.missingAlt, Array.isArray(r.issues) ? r.issues.join("; ") : ""
    ])
  ];
  return rows.map((row) => row.map(safeCsvValue).join(",")).join("\r\n");
}


export function buildAuditSnapshot(results, metadata = {}) {
  const siteOrigin = typeof metadata.siteOrigin === "string" ? metadata.siteOrigin : "";
  let parsedOrigin = "";
  try {
    const parsed = new URL(siteOrigin);
    if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("Unsupported origin protocol");
    parsedOrigin = parsed.origin;
  } catch {
    throw new TypeError("A valid HTTP(S) siteOrigin is required");
  }
  const scope = metadata.scope === "sitemap" ? "sitemap" : metadata.scope === "core" ? "core" : null;
  if (!scope) throw new TypeError("Snapshot scope must be sitemap or core");
  const capturedAt = typeof metadata.capturedAt === "string" && !Number.isNaN(Date.parse(metadata.capturedAt))
    ? new Date(metadata.capturedAt).toISOString()
    : new Date().toISOString();
  const pages = (Array.isArray(results) ? results : []).map((page) => ({
    path: String(page.path ?? ""),
    status: Number.isInteger(page.status) ? page.status : null,
    title: String(page.title ?? ""),
    description: String(page.desc ?? ""),
    h1Count: Number.isInteger(page.h1) ? page.h1 : 0,
    canonicalUrl: String(page.canonical ?? ""),
    robots: String(page.robots ?? ""),
    hasViewport: Boolean(page.viewport),
    openGraphTitle: String(page.ogTitle ?? ""),
    imagesMissingAlt: Number.isInteger(page.missingAlt) ? page.missingAlt : 0,
    findings: Array.isArray(page.issues) ? page.issues.map(String) : []
  }));
  return {
    schemaVersion: 1,
    source: "browser_live_crawl",
    siteOrigin: parsedOrigin,
    scope,
    capturedAt,
    pageCount: pages.length,
    issueCount: pages.reduce((count, page) => count + page.findings.length, 0),
    pages
  };
}
