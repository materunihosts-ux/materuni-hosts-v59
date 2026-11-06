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
