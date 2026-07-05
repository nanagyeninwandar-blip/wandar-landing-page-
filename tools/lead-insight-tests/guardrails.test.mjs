/* Guardrail checks for the classify function — offline (no API key, no network).
 *
 *   node --test tools/lead-insight-tests/guardrails.test.mjs
 *
 * Exercises the handler directly with standard Request objects.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import handler from "../../netlify/functions/classify.mjs";

const ORIGIN = "https://www.getwandar.com";

function post(body, { origin = ORIGIN, ip = "203.0.113.7", method = "POST" } = {}) {
  const headers = { "content-type": "application/json" };
  if (origin) headers.origin = origin;
  return handler(
    new Request("https://www.getwandar.com/api/classify", {
      method,
      headers,
      body: method === "POST" ? JSON.stringify(body) : undefined,
    }),
    { ip }
  );
}

test("GET is rejected with 405", async () => {
  const res = await post(null, { method: "GET" });
  assert.equal(res.status, 405);
});

test("missing origin/referer is rejected with 403", async () => {
  const res = await post({ enquiry: "Safari in Kenya" }, { origin: null });
  assert.equal(res.status, 403);
});

test("foreign origin is rejected with 403", async () => {
  const res = await post({ enquiry: "Safari in Kenya" }, { origin: "https://evil.example.com" });
  assert.equal(res.status, 403);
});

test("empty enquiry is rejected with 400 before any API call", async () => {
  const res = await post({ enquiry: "   " }, { ip: "203.0.113.10" });
  assert.equal(res.status, 400);
  assert.equal((await res.json()).error, "empty_enquiry");
});

test("oversize enquiry is rejected with 400 before any API call", async () => {
  const res = await post({ enquiry: "x".repeat(5001) }, { ip: "203.0.113.11" });
  assert.equal(res.status, 400);
  assert.equal((await res.json()).error, "enquiry_too_long");
});

test("malformed JSON is rejected with 400", async () => {
  const res = await handler(
    new Request("https://www.getwandar.com/api/classify", {
      method: "POST",
      headers: { origin: ORIGIN, "content-type": "application/json" },
      body: "{not json",
    }),
    { ip: "203.0.113.12" }
  );
  assert.equal(res.status, 400);
});

test("without ANTHROPIC_API_KEY a valid request returns 500 not_configured", async () => {
  const prev = process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  try {
    const res = await post({ enquiry: "Safari in Kenya, July 2027" }, { ip: "203.0.113.13" });
    assert.equal(res.status, 500);
    assert.equal((await res.json()).error, "not_configured");
  } finally {
    if (prev !== undefined) process.env.ANTHROPIC_API_KEY = prev;
  }
});

test("per-IP rate limit trips with 429 after 8 requests in a minute", async () => {
  const ip = "203.0.113.99";
  let lastStatus = 0;
  for (let i = 0; i < 9; i++) {
    const res = await post({ enquiry: "" }, { ip }); // empty → cheap 400s that still count
    lastStatus = res.status;
  }
  assert.equal(lastStatus, 429);
});
