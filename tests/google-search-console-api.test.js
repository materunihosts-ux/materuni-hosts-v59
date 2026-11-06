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
