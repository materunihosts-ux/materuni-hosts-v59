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
  const matches = xmlText.matchAll(/<loc(?:\s[^>]*)?>([\s\S]*?)<\/loc>/gi);
  const paths = new Set();
  for (const match of matches) {
    const raw = match[1].replace(/&amp;/g, "&").trim();
    if (!raw || !isSameOriginUrl(raw, origin)) continue;
    try {
      const url = new URL(raw, origin);
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
