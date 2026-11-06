// Read-only Google Search Console connector. Secrets remain in the Vercel server environment.
const windows = new Map();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_REQUESTS = 20;

function send(res, status, body) {
  return res.status(status).setHeader("Cache-Control", "no-store").json(body);
}
function validDate(value) {
  if (typeof value !== "string" || !/^\\d{4}-\\d{2}-\\d{2}$/.test(value)) return false;
  const parsed = new Date(value + "T00:00:00Z");
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}
}
function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  try { return new URL(origin).host === (req.headers.host || ""); } catch { return false; }
}
function throttle(userId) {
  const now = Date.now();
  const recent = (windows.get(userId) || []).filter((stamp) => now - stamp < WINDOW_MS);
  if (recent.length >= MAX_REQUESTS) return false;
  recent.push(now);
  windows.set(userId, recent);
  return true;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return send(res, 405, { error: "Method not allowed." });
  if (!sameOrigin(req)) return send(res, 403, { error: "Origin not allowed." });

  const authorization = req.headers.authorization || "";
  const accessToken = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!accessToken) return send(res, 401, { error: "Administrator sign-in is required." });

  const supabaseUrl = (process.env.SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL || "").replace(/\\/+$/, "");
  const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !supabaseKey) return send(res, 503, { error: "Server-side Supabase authentication is not configured." });

  try {
    const userResponse = await fetch(supabaseUrl + "/auth/v1/user", {
      headers: { apikey: supabaseKey, Authorization: "Bearer " + accessToken },
      signal: AbortSignal.timeout(10000)
    });
    if (!userResponse.ok) return send(res, 401, { error: "Your session has expired. Sign in again." });
    const user = await userResponse.json();
    if (!user?.id) return send(res, 401, { error: "A valid administrator session is required." });

    const adminResponse = await fetch(supabaseUrl + "/rest/v1/admin_users?select=user_id&user_id=eq." + encodeURIComponent(user.id), {
      headers: { apikey: supabaseKey, Authorization: "Bearer " + accessToken, Accept: "application/json" },
      signal: AbortSignal.timeout(10000)
    });
    if (!adminResponse.ok) return send(res, 403, { error: "Could not verify administrator permissions." });
    const admins = await adminResponse.json();
    if (!Array.isArray(admins) || admins.length === 0) return send(res, 403, { error: "Administrator access is required." });
    if (!throttle(user.id)) return send(res, 429, { error: "Search Console request limit reached. Wait ten minutes and retry." });

    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const startDate = body.startDate;
    const endDate = body.endDate;
    const dimension = body.dimension === "page" ? "page" : "query";
    if (!validDate(startDate) || !validDate(endDate) || startDate > endDate) {
      return send(res, 400, { error: "Choose a valid date range. Start date must be on or before end date." });
    }
    const days = (Date.parse(endDate + "T00:00:00Z") - Date.parse(startDate + "T00:00:00Z")) / 86400000;
    if (days > 92) return send(res, 400, { error: "Keep each report to 93 days or fewer for a fast, predictable response." });

    const clientId = process.env.GOOGLE_SEARCH_CONSOLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_SEARCH_CONSOLE_CLIENT_SECRET;
    const refreshToken = process.env.GOOGLE_SEARCH_CONSOLE_REFRESH_TOKEN;
    const siteUrl = process.env.GOOGLE_SEARCH_CONSOLE_SITE_URL;
    if (!clientId || !clientSecret || !refreshToken || !siteUrl) {
      return send(res, 503, {
        error: "Google Search Console is not configured yet. Add GOOGLE_SEARCH_CONSOLE_CLIENT_ID, GOOGLE_SEARCH_CONSOLE_CLIENT_SECRET, GOOGLE_SEARCH_CONSOLE_REFRESH_TOKEN and GOOGLE_SEARCH_CONSOLE_SITE_URL to the Vercel Preview environment, then redeploy the preview."
      });
    }
    if (!/^https:\\/\\//.test(siteUrl) && !/^sc-domain:[a-z0-9.-]+$/i.test(siteUrl)) {
      return send(res, 503, { error: "GOOGLE_SEARCH_CONSOLE_SITE_URL must be an https property URL or sc-domain:example.com." });
    }

    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token"
      }),
      signal: AbortSignal.timeout(15000)
    });
    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok || !tokenData.access_token) {
      return send(res, 502, { error: "Google could not refresh the Search Console connection. Re-authorise the Google account and replace the Preview refresh token." });
    }

    const queryResponse = await fetch(
      "https://www.googleapis.com/webmasters/v3/sites/" + encodeURIComponent(siteUrl) + "/searchAnalytics/query",
      {
        method: "POST",
        headers: { Authorization: "Bearer " + tokenData.access_token, "Content-Type": "application/json" },
        body: JSON.stringify({
          startDate,
          endDate,
          dimensions: [dimension],
          rowLimit: 250,
          dataState: "final"
        }),
        signal: AbortSignal.timeout(20000)
      }
    );
    const data = await queryResponse.json();
    if (!queryResponse.ok) {
      const reason = data?.error?.errors?.[0]?.reason || "";
      const message = reason === "permissionDenied"
        ? "The connected Google account does not have access to this Search Console property."
        : "Google Search Console could not return this report. Check the property URL and account permissions.";
      return send(res, 502, { error: message });
    }

    const rows = Array.isArray(data.rows) ? data.rows.map((row) => ({
      key: Array.isArray(row.keys) ? String(row.keys[0] || "") : "",
      clicks: Number(row.clicks || 0),
      impressions: Number(row.impressions || 0),
      ctr: Number(row.ctr || 0),
      position: Number(row.position || 0)
    })) : [];
    const totals = rows.reduce((acc, row) => ({
      clicks: acc.clicks + row.clicks,
      impressions: acc.impressions + row.impressions
    }), { clicks: 0, impressions: 0 });
    return send(res, 200, {
      source: "google_search_console_api",
      property: siteUrl,
      dimension,
      startDate,
      endDate,
      returnedRows: rows.length,
      totals: {
        clicks: totals.clicks,
        impressions: totals.impressions,
        ctr: totals.impressions ? totals.clicks / totals.impressions : 0,
        averagePosition: rows.length ? rows.reduce((sum, row) => sum + row.position, 0) / rows.length : 0
      },
      rows,
      fetchedAt: new Date().toISOString(),
      note: "Google Search Console API result. Rows are limited to the top 250 for the selected dimension; totals are calculated from returned rows and are not the property-wide total."
    });
  } catch (error) {
    if (error instanceof SyntaxError) return send(res, 400, { error: "Request body must be valid JSON." });
    if (error?.name === "TimeoutError" || error?.name === "AbortError") return send(res, 504, { error: "The Google Search Console request timed out. Try a shorter date range." });
    return send(res, 500, { error: "Search Console request failed safely. Check Vercel Preview runtime logs." });
  }
}
