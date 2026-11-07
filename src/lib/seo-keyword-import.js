const normHeader = (value) => String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");

const HEADER_ALIASES = {
  keyword: ["keyword", "query", "search_term", "search_query", "top_queries", "top_query"],
  volume: ["volume", "search_volume", "monthly_searches"],
  difficulty: ["difficulty", "keyword_difficulty", "kd"],
  intent: ["intent", "search_intent"],
  targetUrl: ["url", "target_url", "page", "landing_page"],
  position: ["position", "average_position", "avg_position"],
  clicks: ["clicks"],
  impressions: ["impressions"]
};

function indexFor(headers, key) {
  const aliases = HEADER_ALIASES[key];
  return headers.findIndex((header) => aliases.includes(normHeader(header)));
}

function numberValue(value, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  if (value == null || String(value).trim() === "") return null;
  const cleaned = String(value).trim().replace(/,/g, "").replace(/%$/, "");
  const number = Number(cleaned);
  return Number.isFinite(number) && number >= min && number <= max ? number : NaN;
}

/**
 * Classifies a user-supplied CSV by its header shape. It does not authenticate
 * the file or prove that it originated from Google Search Console/a provider.
 */
export function classifyKeywordCsv(headers) {
  if (!Array.isArray(headers) || !headers.length) throw new TypeError("CSV header row is required");
  const columns = Object.fromEntries(Object.keys(HEADER_ALIASES).map((key) => [key, indexFor(headers, key)]));
  if (columns.keyword < 0) throw new TypeError("Could not find a Keyword or Query column");
  const looksLikeGsc = columns.clicks >= 0 && columns.impressions >= 0 && columns.position >= 0;
  const looksLikeVolume = columns.volume >= 0;
  return {
    columns,
    sourceKind: looksLikeGsc ? "search_performance_export" : looksLikeVolume ? "keyword_metrics_export" : "keyword_list",
    provenanceLabel: looksLikeGsc
      ? "Search performance export (user-supplied CSV; not API-verified)"
      : looksLikeVolume
        ? "Keyword metrics export (user-supplied CSV; provider not verified)"
        : "Keyword list (user-supplied CSV)"
  };
}

/** Validate and normalize one row before it is sent to the keyword table. */
export function normalizeKeywordImportRow(row, columns, siteOrigin) {
  if (!Array.isArray(row) || !columns || typeof columns !== "object") throw new TypeError("Invalid keyword import row");
  const cell = (key) => columns[key] >= 0 ? String(row[columns[key]] ?? "").trim() : "";
  const keyword = cell("keyword");
  if (!keyword) return { skip: true, reason: "empty_keyword" };
  if (keyword.length > 300) return { error: "Keyword exceeds 300 characters" };

  const intentRaw = cell("intent").toLowerCase().replace(/\s+/g, "_");
  const allowedIntents = new Set(["informational", "commercial", "transactional", "navigational"]);
  const intent = allowedIntents.has(intentRaw) ? intentRaw : "informational";

  const volume = numberValue(cell("volume"));
  const difficulty = numberValue(cell("difficulty"), { max: 100 });
  const position = numberValue(cell("position"), { min: 0.01 });
  const clicks = numberValue(cell("clicks"));
  const impressions = numberValue(cell("impressions"));
  for (const [label, value] of [["Search volume", volume], ["Difficulty", difficulty], ["Position", position], ["Clicks", clicks], ["Impressions", impressions]]) {
    if (Number.isNaN(value)) return { error: label + " contains an invalid or out-of-range number" };
  }

  let targetUrl = cell("targetUrl") || null;
  if (targetUrl) {
    try {
      const base = new URL(siteOrigin);
      const resolved = new URL(targetUrl, base);
      if (!["http:", "https:"].includes(resolved.protocol) || resolved.origin !== base.origin || resolved.username || resolved.password) {
        return { error: "Target URL must belong to the configured website" };
      }
      targetUrl = resolved.origin + resolved.pathname + resolved.search;
    } catch {
      return { error: "Target URL is invalid" };
    }
  }

  return {
    value: {
      keyword,
      search_volume: volume,
      difficulty,
      intent,
      target_url: targetUrl,
      current_position: position,
      clicks: clicks ?? 0,
      impressions: impressions ?? 0,
      priority: "medium",
      status: "research",
      source: "csv_import"
    }
  };
}
