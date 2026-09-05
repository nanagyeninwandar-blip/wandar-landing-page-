/* One-shot backfill of leads.destinations.

   Run AFTER the destinations migration. Idempotent: it only touches rows where
   destinations is null, so a partial run resumes rather than redoing. A row that
   genuinely names nowhere is written as '{}' — an answer, not a gap — so it is
   never re-examined.

   Costs nothing: keyword matching only, no model call, no Apify.

   Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE
   Usage: node backfill-destinations.mjs [--dry-run]                            */

import { extractDestinations } from "./destinations.mjs";

const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE;
const DRY = process.argv.includes("--dry-run");
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };

if (!URL || !KEY) { console.error("set SUPABASE_URL and SUPABASE_SERVICE_ROLE"); process.exit(1); }

const res = await fetch(`${URL}/rest/v1/leads?select=id,title,body,url&destinations=is.null&limit=2000`, { headers: H });
if (!res.ok) { console.error(`read ${res.status}: ${await res.text()}`); process.exit(1); }
const rows = await res.json();
console.log(`${rows.length} rows without destinations`);
if (!rows.length) { console.log("nothing to do"); process.exit(0); }

const tally = {}; let none = 0, multi = 0;
const updates = rows.map((r) => {
  const d = extractDestinations(r.title, r.body, r.url);
  if (!d.length) none++; else if (d.length > 1) multi++;
  d.forEach((k) => (tally[k] = (tally[k] || 0) + 1));
  return { id: r.id, destinations: d };
});

console.log(`matched ${rows.length - none} · none ${none} · multi-country ${multi}`);
console.log(Object.entries(tally).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(" · "));
if (DRY) { console.log("\nDRY RUN — nothing written"); process.exit(0); }

/* PATCH per row. An upsert would need every NOT NULL column echoed back, and
   getting that wrong rewrites live rows with partial data. */
let ok = 0;
for (const u of updates) {
  const r = await fetch(`${URL}/rest/v1/leads?id=eq.${u.id}`, {
    method: "PATCH",
    headers: { ...H, Prefer: "return=minimal" },
    body: JSON.stringify({ destinations: u.destinations }),
  });
  if (r.ok) ok++; else console.error(`  id ${u.id}: ${r.status} ${await r.text()}`);
}
console.log(`updated ${ok}/${updates.length}`);
