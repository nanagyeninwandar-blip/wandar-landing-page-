/* Upsert already-scored leads from a JSON file.

   Why this exists: the scan pipeline classifies via the Anthropic API, but the
   classification step can be done offline (by hand, or in a Claude Code session)
   when no working ANTHROPIC_API_KEY is available. This is the write half of the
   pipeline on its own — same table, same upsert semantics, no scraping and no
   model call. Rows must already carry `tier` and `score` from score.mjs.

   The repo is public, so this deliberately logs counts only, never row content. */

import fs from "node:fs";

const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE;
const FILE = process.argv[2] || "pending-leads.json";
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };

const COLS = ["thread_id", "source", "title", "body", "url", "post_date", "tier", "score", "scanned_on"];

async function count() {
  const r = await fetch(`${URL}/rest/v1/leads?select=id&limit=1`, {
    headers: { ...H, Prefer: "count=exact", Range: "0-0" },
  });
  return Number((r.headers.get("content-range") || "0-0/0").split("/")[1]);
}

const rows = JSON.parse(fs.readFileSync(FILE, "utf8"));
if (!Array.isArray(rows) || !rows.length) { console.error("no rows to import"); process.exit(1); }

// Reject unknown columns here rather than letting PostgREST 400 the whole batch
// (PGRST204 on one bad key writes nothing at all — the failure mode TRAVEL_COLS_LIVE guards).
for (const [i, r] of rows.entries()) {
  const bad = Object.keys(r).filter(k => !COLS.includes(k));
  if (bad.length) { console.error(`row ${i} has unknown columns: ${bad.join(", ")}`); process.exit(1); }
  if (!r.thread_id || !r.tier || typeof r.score !== "number") {
    console.error(`row ${i} missing thread_id/tier/score`); process.exit(1);
  }
}

const tiers = rows.reduce((a, r) => (a[r.tier] = (a[r.tier] || 0) + 1, a), {});
console.log(`importing ${rows.length} leads from ${FILE}`, tiers);

const before = await count();
const res = await fetch(`${URL}/rest/v1/leads?on_conflict=thread_id`, {
  method: "POST",
  headers: { ...H, Prefer: "resolution=merge-duplicates,return=minimal" },
  body: JSON.stringify(rows),
});
if (!res.ok) { console.error(`Supabase write ${res.status}: ${await res.text()}`); process.exit(1); }
const after = await count();
console.log(`Supabase: ${before} -> ${after} (upserted ${rows.length}, ${after - before} new)`);
