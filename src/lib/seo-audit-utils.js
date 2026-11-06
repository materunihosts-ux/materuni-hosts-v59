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


const SNAPSHOT_PAGE_FIELDS = [
  "status", "title", "description", "h1Count", "canonicalUrl", "robots",
  "hasViewport", "openGraphTitle", "imagesMissingAlt"
];

function validateComparableSnapshot(snapshot, label) {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
    throw new TypeError(`${label} must be a snapshot object`);
  }
  if (snapshot.schemaVersion !== 1 || snapshot.source !== "browser_live_crawl") {
    throw new TypeError(`${label} must be a supported browser crawl snapshot (schema v1)`);
  }
  let origin;
  try {
    origin = new URL(snapshot.siteOrigin);
    if (!["http:", "https:"].includes(origin.protocol) || origin.origin !== snapshot.siteOrigin) throw new Error();
  } catch {
    throw new TypeError(`${label} has an invalid siteOrigin`);
  }
  if (!Array.isArray(snapshot.pages)) throw new TypeError(`${label}.pages must be an array`);
  const pages = new Map();
  for (const page of snapshot.pages) {
    if (!page || typeof page.path !== "string" || !page.path.startsWith("/") || page.path.startsWith("//")) {
      throw new TypeError(`${label} contains an invalid page path`);
    }
    if (pages.has(page.path)) throw new TypeError(`${label} contains duplicate page paths`);
    pages.set(page.path, page);
  }
  return { origin: origin.origin, pages };
}

/**
 * Compare two exported browser-crawl snapshots. This reports observed changes,
 * not Google ranking, traffic, backlink or search-performance changes.
 */
export function compareAuditSnapshots(previous, current) {
  const before = validateComparableSnapshot(previous, "previous snapshot");
  const after = validateComparableSnapshot(current, "current snapshot");
  if (before.origin !== after.origin) throw new TypeError("Snapshots must have the same siteOrigin");
  if (previous.scope !== current.scope || !["core", "sitemap"].includes(previous.scope)) throw new TypeError("Snapshots must have the same valid crawl scope");

  const added = [];
  const removed = [];
  const changed = [];
  const unchanged = [];
  for (const [path, nextPage] of after.pages) {
    const oldPage = before.pages.get(path);
    if (!oldPage) {
      added.push({ path, findings: Array.isArray(nextPage.findings) ? [...nextPage.findings] : [] });
      continue;
    }
    const fieldChanges = {};
    for (const field of SNAPSHOT_PAGE_FIELDS) {
      if (JSON.stringify(oldPage[field] ?? null) !== JSON.stringify(nextPage[field] ?? null)) {
        fieldChanges[field] = { before: oldPage[field] ?? null, after: nextPage[field] ?? null };
      }
    }
    const oldFindings = Array.isArray(oldPage.findings) ? oldPage.findings : [];
    const newFindings = Array.isArray(nextPage.findings) ? nextPage.findings : [];
    const oldSet = new Set(oldFindings.map(String));
    const newSet = new Set(newFindings.map(String));
    const findingChanges = {
      added: [...newSet].filter((item) => !oldSet.has(item)),
      resolved: [...oldSet].filter((item) => !newSet.has(item))
    };
    if (Object.keys(fieldChanges).length || findingChanges.added.length || findingChanges.resolved.length) {
      changed.push({ path, fields: fieldChanges, findings: findingChanges });
    } else {
      unchanged.push(path);
    }
  }
  for (const path of before.pages.keys()) {
    if (!after.pages.has(path)) removed.push(path);
  }
  return {
    schemaVersion: 1,
    source: "browser_snapshot_comparison",
    siteOrigin: before.origin,
    previousCapturedAt: previous.capturedAt ?? null,
    currentCapturedAt: current.capturedAt ?? null,
    summary: {
      previousPageCount: before.pages.size,
      currentPageCount: after.pages.size,
      addedPages: added.length,
      removedPages: removed.length,
      changedPages: changed.length,
      unchangedPages: unchanged.length,
      newFindings: changed.reduce((n, page) => n + page.findings.added.length, 0) + added.reduce((n, page) => n + page.findings.length, 0),
      resolvedFindings: changed.reduce((n, page) => n + page.findings.resolved.length, 0)
    },
    added, removed, changed, unchanged
  };
}
