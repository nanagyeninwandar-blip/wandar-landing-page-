/* Wandar Safari Demand — weekly scan.
   Runs on GitHub Actions. The Claude cloud routine cannot do this: its sandbox
   blocks all outbound egress, including api.apify.com and *.supabase.co
   (probed 2026-08-18 — every host returns CONNECT tunnel failed / 403).

   Pipeline: budget guard -> scrape -> dedupe -> Layer 1/2 (Claude) ->
   Layer 3 (deterministic) -> upsert to Supabase.
   Pass --dry-run to do everything except spend money or write. */

import fs from "node:fs";
import { TA_FORUMS, RD_BLANKET, RD_GENERAL, RD_TERMS, TA_TITLE_KILL } from "./sources.mjs";
import { getSpend, plan, describe, COST } from "./budget.mjs";
import { taIndex, taBodies, reddit } from "./apify.mjs";
import { classify, preflight } from "./classify.mjs";
import { scoreSig } from "./score.mjs";
import { existingThreadIds, lastScanDate, writeLeads, leadCount } from "./supabase.mjs";

const DRY = process.argv.includes("--dry-run");
const SEEN_FILE = process.env.SEEN_FILE || "seen-threads.json";
const TODAY = new Date().toISOString().slice(0, 10);
const log = (...a) => console.log(...a);

const MONTHS = { Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11 };
function iso(d) {                       // "Jun 03, 2026" -> "2026-06-03"
  const m = (d || "").match(/([A-Z][a-z]{2}) (\d{1,2}), (\d{4})/);
  if (!m || !(m[1] in MONTHS)) return null;
  return `${m[3]}-${String(MONTHS[m[1]] + 1).padStart(2, "0")}-${String(+m[2]).padStart(2, "0")}`;
}
const daysAgo = n => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);

function loadSeen() {
  try { return new Set(JSON.parse(fs.readFileSync(SEEN_FILE, "utf8"))); }
  catch { return new Set(); }
}

async function main() {
  log(`=== Wandar scan ${TODAY}${DRY ? " (DRY RUN)" : ""} ===`);

  // ---- 0. Preflight: prove we can classify before we pay to scrape ---------
  const pre = await preflight();
  if (!pre.ok) {
    console.error(`PREFLIGHT FAILED: ${pre.reason}`);
    console.error("Nothing scraped, nothing spent. Fix the key and re-run.");
    process.exit(1);
  }
  log(`preflight ok (${pre.model})`);

  // ---- 1. Budget guard -----------------------------------------------------
  const spend = await getSpend(process.env.APIFY_TOKEN);
  const p = plan(spend);
  log(describe(p, spend));
  if (p.skip) { log("Nothing spent. Exiting cleanly."); return; }

  // ---- 2. State ------------------------------------------------------------
  const existing = await existingThreadIds();
  const seen = loadSeen();
  const since = (await lastScanDate()) || daysAgo(30);
  log(`live leads: ${existing.size} | seen threads: ${seen.size} | reddit window from: ${since}`);

  let cost = 0;
  const posts = [];

  // ---- 3. TripAdvisor ------------------------------------------------------
  const idx = await taIndex(TA_FORUMS);
  cost += idx.cost;
  const threads = new Map();
  for (const page of idx.rows)
    for (const t of page.topics || []) {
      const m = t.url.match(/-k(\d+)-/); if (!m) continue;
      threads.set(`ta_${m[1]}`, { ...t, forum: page.forum, post_date: iso(t.date) });
    }
  const cutoff = daysAgo(90);          // "strong live leads only" — the standing call
  const fresh = [...threads].filter(([, t]) => t.post_date && t.post_date >= cutoff);
  const candidates = fresh
    .filter(([id]) => !existing.has(id) && !seen.has(id))   // seen-list: never re-judge a reject
    .filter(([, t]) => !TA_TITLE_KILL.test(t.title))
    .slice(0, 300);                                         // hard cap on pass-2 spend
  log(`TA: ${threads.size} threads -> ${fresh.length} in 90d -> ${candidates.length} new candidates ($${idx.cost.toFixed(3)})`);

  const bodies = await taBodies(candidates.map(([, t]) => t.url));
  cost += bodies.cost;
  const byUrl = new Map(candidates.map(([id, t]) => [t.url, { id, ...t }]));
  for (const r of bodies.rows) {
    const meta = byUrl.get(r.url);
    if (!meta || (r.openingPost || "").trim().length < 25) continue;
    posts.push({ id: meta.id, source: "tripadvisor", origin: meta.forum,
                 title: (r.title || meta.title).trim(), body: r.openingPost,
                 url: r.url, post_date: meta.post_date });
  }
  log(`TA: ${posts.length} scoreable bodies ($${bodies.cost.toFixed(3)})`);

  // Every candidate is now judged — record them so we never pay to re-scrape.
  candidates.forEach(([id]) => seen.add(id));

  // ---- 4. Reddit -----------------------------------------------------------
  // A dry run must not spend on the most expensive source just to prove a path
  // it won't use. TripAdvisor above is cheap enough to exercise for real; Reddit
  // is $0.004/item and can run 25 minutes, so cap it hard here.
  const rdCap = DRY ? Math.min(p.rdMaxItems, 10) : p.rdMaxItems;
  if (!p.taOnly && rdCap > 0) {
    const rd = await reddit({
      blanket: RD_BLANKET, general: RD_GENERAL, terms: RD_TERMS,
      since, maxItems: rdCap,
    });
    cost += rd.cost;
    const seenTitle = new Set();
    let kept = 0;
    for (const r of rd.rows) {
      const id = `rd_${r.parsedId || ""}`;
      if (!r.parsedId || existing.has(id)) continue;
      // Cross-posts: the same trip posted to several subs — keep the first.
      const key = (r.title || "").toLowerCase().replace(/\W+/g, "").slice(0, 60);
      if (seenTitle.has(key)) continue;
      seenTitle.add(key);
      posts.push({ id, source: "reddit", origin: r.communityName || "",
                   title: (r.title || "").trim(), body: r.body || "",
                   url: r.url, post_date: (r.createdAt || "").slice(0, 10) });
      kept++;
    }
    log(`Reddit: ${rd.rows.length} items -> ${kept} new (${rd.status}, $${rd.cost.toFixed(3)})`);
  } else {
    log(`Reddit: skipped (${p.taOnly ? "budget guard" : "dry run"})`);
  }

  log(`Apify spend this run: $${cost.toFixed(3)}`);
  if (!posts.length) { log("No new posts to classify. Done."); return; }

  // ---- 5. Layers 1/2 then 3 ------------------------------------------------
  if (DRY) { log(`DRY RUN: would classify ${posts.length} posts, then write. Stopping.`); return; }

  log(`classifying ${posts.length} posts...`);
  const { judgments, usage, model } = await classify(posts, { today: TODAY });
  const byId = new Map(posts.map(x => [x.id, x]));
  const leads = [];
  for (const j of judgments) {
    if (!j.pass) continue;
    const post = byId.get(j.id);
    if (!post) continue;                                   // hallucinated id — drop
    const { score, tier } = scoreSig({ d: j.d, t: j.t, b: j.b, g: j.g, u: j.u });
    if (score < 4.0) continue;                             // Eliminated
    leads.push({ ...post, score, tier });
  }
  const tiers = leads.reduce((a, l) => (a[l.tier] = (a[l.tier] || 0) + 1, a), {});
  log(`qualified: ${leads.length} of ${posts.length} (${(100 * leads.length / posts.length).toFixed(0)}%)`, tiers);
  log(`claude: ${model} | in ${usage.input} (cache read ${usage.cacheRead}) out ${usage.output}`);

  // ---- 6. Write ------------------------------------------------------------
  const before = await leadCount();
  const written = await writeLeads(leads);
  const after = await leadCount();
  log(`Supabase: ${before} -> ${after} (upserted ${written})`);

  fs.writeFileSync(SEEN_FILE, JSON.stringify([...seen]));
  log(`seen-thread ledger: ${seen.size} ids`);
}

main().catch(e => { console.error("SCAN FAILED:", e); process.exit(1); });
