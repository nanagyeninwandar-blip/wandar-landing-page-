/* Wandar scan — SCRAPE HALF ONLY.

   Same as scan.mjs steps 0-4, but stops before classify() and dumps the
   candidate posts to JSON. For when ANTHROPIC_API_KEY is dead: Layers 1/2 get
   done offline in a Claude Code session, scored with score.mjs, then loaded
   with import-leads.mjs. Spends Apify money; writes nothing to Supabase.

   Usage: node scrape-only.mjs [outfile]   (default scraped-posts.json) */

import fs from "node:fs";
import { TA_FORUMS, RD_BLANKET, RD_GENERAL, RD_TERMS, TA_TITLE_KILL } from "./sources.mjs";
import { getSpend, plan, describe } from "./budget.mjs";
import { taIndex, taBodies, reddit } from "./apify.mjs";
import { existingThreadIds, lastScanDate } from "./supabase.mjs";

const OUT = process.argv[2] || "scraped-posts.json";
const SEEN_FILE = process.env.SEEN_FILE || "seen-threads.json";
const TODAY = new Date().toISOString().slice(0, 10);
const log = (...a) => console.log(...a);

const MONTHS = { Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11 };
function iso(d) {
  const m = (d || "").match(/([A-Z][a-z]{2}) (\d{1,2}), (\d{4})/);
  if (!m || !(m[1] in MONTHS)) return null;
  return `${m[3]}-${String(MONTHS[m[1]] + 1).padStart(2, "0")}-${String(+m[2]).padStart(2, "0")}`;
}
const daysAgo = n => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);
function loadSeen() {
  try { return new Set(JSON.parse(fs.readFileSync(SEEN_FILE, "utf8"))); } catch { return new Set(); }
}

function save(posts, seen) {
  fs.writeFileSync(SEEN_FILE, JSON.stringify([...seen]));
  fs.writeFileSync(OUT, JSON.stringify(posts, null, 1));
}

async function main() {
  log(`=== Wandar scrape-only ${TODAY} ===`);

  const spend = await getSpend(process.env.APIFY_TOKEN);
  const p = plan(spend);
  log(describe(p, spend));
  if (p.skip) { log("Nothing spent. Exiting cleanly."); return; }

  const existing = await existingThreadIds();
  const seen = loadSeen();
  const since = (await lastScanDate()) || daysAgo(30);
  log(`live leads: ${existing.size} | seen threads: ${seen.size} | reddit window from: ${since}`);

  let cost = 0;
  const posts = [];

  // ---- TripAdvisor ---------------------------------------------------------
  // Pass 1 is paid for the moment it returns; cache it same-day so a crash in
  // pass 2 (or Reddit) doesn't make the retry buy the same index twice.
  const IDX_CACHE = `ta-index-${TODAY}.json`;
  let idx;
  if (fs.existsSync(IDX_CACHE)) {
    idx = JSON.parse(fs.readFileSync(IDX_CACHE, "utf8"));
    log(`TA index: reusing today's cache (${IDX_CACHE}, $0 this run)`);
  } else {
    idx = await taIndex(TA_FORUMS);
    fs.writeFileSync(IDX_CACHE, JSON.stringify(idx));
    cost += idx.cost;
  }
  const threads = new Map();
  for (const page of idx.rows)
    for (const t of page.topics || []) {
      const m = t.url.match(/-k(\d+)-/); if (!m) continue;
      threads.set(`ta_${m[1]}`, { ...t, forum: page.forum, post_date: iso(t.date) });
    }
  const cutoff = daysAgo(90);
  const fresh = [...threads].filter(([, t]) => t.post_date && t.post_date >= cutoff);
  const candidates = fresh
    .filter(([id]) => !existing.has(id) && !seen.has(id))
    .filter(([, t]) => !TA_TITLE_KILL.test(t.title))
    .slice(0, 300);
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
  candidates.forEach(([id]) => seen.add(id));
  save(posts, seen);                      // checkpoint before the 30-60 min Reddit leg

  // ---- Reddit --------------------------------------------------------------
  if (!p.taOnly && p.rdMaxItems > 0) {
    try {
    const rd = await reddit({ blanket: RD_BLANKET, general: RD_GENERAL, terms: RD_TERMS,
                              since, maxItems: p.rdMaxItems });
    cost += rd.cost;
    const seenTitle = new Set();
    let kept = 0;
    for (const r of rd.rows) {
      const id = `rd_${r.parsedId || ""}`;
      if (!r.parsedId || existing.has(id)) continue;
      const key = (r.title || "").toLowerCase().replace(/\W+/g, "").slice(0, 60);
      if (seenTitle.has(key)) continue;
      seenTitle.add(key);
      posts.push({ id, source: "reddit", origin: r.communityName || "",
                   title: (r.title || "").trim(), body: r.body || "",
                   url: r.url, post_date: (r.createdAt || "").slice(0, 10) });
      kept++;
    }
    log(`Reddit: ${rd.rows.length} items -> ${kept} new (${rd.status}, $${rd.cost.toFixed(3)})`);
  } catch (e) {
    log(`Reddit: FAILED (${e.message}) — keeping the TripAdvisor posts already saved`);
  }
  } else {
    log(`Reddit: skipped (budget guard)`);
  }

  log(`Apify spend this run: $${cost.toFixed(3)}`);
  save(posts, seen);
  log(`wrote ${posts.length} posts -> ${OUT} (classify these offline, then import-leads.mjs)`);
}

main().catch(e => { console.error(e); process.exit(1); });
