import test from "node:test";
import assert from "node:assert/strict";
import handler from "../api/google-search-console.js";

function response() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    status(code) { this.statusCode = code; return this; },
    setHeader(name, value) { this.headers[name] = value; return this; },
    json(value) { this.body = value; return this; }
  };
}

test("Search Console API rejects methods other than POST", async () => {
  const res = response();
  await handler({ method: "GET", headers: {} }, res);
  assert.equal(res.statusCode, 405);
  assert.equal(res.headers["Cache-Control"], "no-store");
});

test("Search Console API rejects cross-origin requests", async () => {
  const res = response();
  await handler({ method: "POST", headers: { origin: "https://attacker.example", host: "materunihosts.com" } }, res);
  assert.equal(res.statusCode, 403);
  assert.match(res.body.error, /Origin/);
});

test("Search Console API requires an administrator bearer session", async () => {
  const res = response();
  await handler({ method: "POST", headers: { host: "materunihosts.com" }, body: {} }, res);
  assert.equal(res.statusCode, 401);
  assert.match(res.body.error, /sign-in/i);
});

test("Search Console API rejects a signed-in non-admin account", async () => {
  const originalFetch = globalThis.fetch;
  const oldUrl = process.env.SUPABASE_URL;
  const oldKey = process.env.SUPABASE_PUBLISHABLE_KEY;
  process.env.SUPABASE_URL = "https://unit-test.supabase.co";
  process.env.SUPABASE_PUBLISHABLE_KEY = "test-publishable-key";
  globalThis.fetch = async (url) => {
    if (String(url).endsWith("/auth/v1/user")) {
      return { ok: true, json: async () => ({ id: "ordinary-user" }) };
    }
    if (String(url).includes("/rest/v1/admin_users")) {
      return { ok: true, json: async () => [] };
    }
    throw new Error("Unexpected upstream request");
  };
  try {
    const res = response();
    await handler({
      method: "POST",
      headers: { host: "materunihosts.com", authorization: "Bearer valid-test-token" },
      body: {}
    }, res);
    assert.equal(res.statusCode, 403);
    assert.match(res.body.error, /administrator/i);
  } finally {
    globalThis.fetch = originalFetch;
    if (oldUrl === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = oldUrl;
    if (oldKey === undefined) delete process.env.SUPABASE_PUBLISHABLE_KEY; else process.env.SUPABASE_PUBLISHABLE_KEY = oldKey;
  }
});

test("Search Console API validates the date range before contacting Google", async () => {
  const originalFetch = globalThis.fetch;
  const oldUrl = process.env.SUPABASE_URL;
  const oldKey = process.env.SUPABASE_PUBLISHABLE_KEY;
  process.env.SUPABASE_URL = "https://unit-test.supabase.co";
  process.env.SUPABASE_PUBLISHABLE_KEY = "test-publishable-key";
  let googleCalled = false;
  globalThis.fetch = async (url) => {
    const target = String(url);
    if (target.endsWith("/auth/v1/user")) {
      return { ok: true, json: async () => ({ id: "admin-user" }) };
    }
    if (target.includes("/rest/v1/admin_users")) {
      return { ok: true, json: async () => [{ user_id: "admin-user" }] };
    }
    googleCalled = true;
    throw new Error("Google must not be contacted for invalid dates");
  };
  try {
    const res = response();
    await handler({
      method: "POST",
      headers: { host: "materunihosts.com", authorization: "Bearer valid-test-token" },
      body: { startDate: "2026-02-30", endDate: "2026-03-01", dimension: "query" }
    }, res);
    assert.equal(res.statusCode, 400);
    assert.equal(googleCalled, false);
  } finally {
    globalThis.fetch = originalFetch;
    if (oldUrl === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = oldUrl;
    if (oldKey === undefined) delete process.env.SUPABASE_PUBLISHABLE_KEY; else process.env.SUPABASE_PUBLISHABLE_KEY = oldKey;
  }
});

test("Search Console API exchanges OAuth refresh token and returns live report shape", async () => {
  const originalFetch = globalThis.fetch;
  const names = ["SUPABASE_URL","SUPABASE_PUBLISHABLE_KEY","GOOGLE_SEARCH_CONSOLE_CLIENT_ID","GOOGLE_SEARCH_CONSOLE_CLIENT_SECRET","GOOGLE_SEARCH_CONSOLE_REFRESH_TOKEN","GOOGLE_SEARCH_CONSOLE_SITE_URL"];
  const previous = Object.fromEntries(names.map((name) => [name, process.env[name]]));
  Object.assign(process.env, {
    SUPABASE_URL: "https://unit-test.supabase.co",
    SUPABASE_PUBLISHABLE_KEY: "test-publishable-key",
    GOOGLE_SEARCH_CONSOLE_CLIENT_ID: "test-client-id",
    GOOGLE_SEARCH_CONSOLE_CLIENT_SECRET: "test-client-secret",
    GOOGLE_SEARCH_CONSOLE_REFRESH_TOKEN: "test-refresh-token",
    GOOGLE_SEARCH_CONSOLE_SITE_URL: "https://materunihosts.com/"
  });
  let oauthBody = null;
  let googleRequest = null;
  globalThis.fetch = async (url, options = {}) => {
    const target = String(url);
    if (target.endsWith("/auth/v1/user")) {
      return { ok: true, json: async () => ({ id: "gsc-success-admin" }) };
    }
    if (target.includes("/rest/v1/admin_users")) {
      return { ok: true, json: async () => [{ user_id: "gsc-success-admin" }] };
    }
    if (target === "https://oauth2.googleapis.com/token") {
      oauthBody = new URLSearchParams(options.body);
      return { ok: true, json: async () => ({ access_token: "google-test-access-token" }) };
    }
    if (target.includes("/searchAnalytics/query")) {
      googleRequest = { url: target, options };
      return {
        ok: true,
        json: async () => ({
          rows: [{ keys: ["materuni coffee tour"], clicks: 10, impressions: 100, ctr: 0.1, position: 4.5 }]
        })
      };
    }
    throw new Error("Unexpected network request: " + target);
  };
  try {
    const res = response();
    await handler({
      method: "POST",
      headers: { host: "materunihosts.com", authorization: "Bearer valid-test-token" },
      body: { startDate: "2026-10-01", endDate: "2026-10-28", dimension: "query" }
    }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(oauthBody.get("grant_type"), "refresh_token");
    assert.equal(oauthBody.get("refresh_token"), "test-refresh-token");
    assert.match(googleRequest.url, /searchAnalytics\/query$/);
    assert.equal(googleRequest.options.headers.Authorization, "Bearer google-test-access-token");
    const query = JSON.parse(googleRequest.options.body);
    assert.deepEqual(query.dimensions, ["query"]);
    assert.equal(query.rowLimit, 250);
    assert.equal(res.body.source, "google_search_console_api");
    assert.equal(res.body.totals.clicks, 10);
    assert.equal(res.body.totals.impressions, 100);
    assert.equal(res.body.rows[0].key, "materuni coffee tour");
    assert.match(res.body.note, /not the property-wide total/);
  } finally {
    globalThis.fetch = originalFetch;
    for (const name of names) {
      if (previous[name] === undefined) delete process.env[name];
      else process.env[name] = previous[name];
    }
  }
});
