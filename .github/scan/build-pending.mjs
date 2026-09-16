/* Layer 3 for the OFFLINE path: turn judgments.json into pending-leads.json.

   The automated pipeline does Layers 1/2 (classify.mjs) and Layer 3 (score.mjs)
   in one process. When the Anthropic key is unavailable, Layers 1/2 are done by
   hand in a Claude Code session and written to judgments.json — one object per
   scraped post, {id, pass, d, t, b, g, u, why}. This script does the rest:
   scores the passes with the SAME scoreSig the automated path uses, cleans the
   bodies with the same rules as supabase.mjs, and writes a file import-leads.mjs
   can upsert.

   Judgment stays human; the number stays deterministic. Run test-scorer first.

   Usage: npm run build   (then npm run import)                                */

import fs from "node:fs";
import { scoreSig } from "./score.mjs";

const posts = JSON.parse(fs.readFileSync("scraped-posts.json", "utf8"));
const judgments = JSON.parse(fs.readFileSync("judgments.json", "utf8"));
const byId = new Map(posts.map((p) => [p.id, p]));

/* Mirrors cleanBody in supabase.mjs — Reddit bodies arrive HTML-escaped with an
   RSS footer, TripAdvisor bodies carry an inline tracking script. */
const NAMED = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
function cleanBody(s) {
  return (s || "")
    .replace(/\(ta && ta\.queueForLoad[\s\S]*?['"]log_autolink_impression['"]\s*\)\s*;?/g, "")
    .replace(/\(ta && ta\.queueForLoad[\s\S]{0,400}?\}\s*\)\s*;?/g, "")
    .replace(/&(#\d+|#x[0-9a-fA-F]+|[a-zA-Z]+);/g, (m, e) => {
      if (e[0] === "#") {
        const cp = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
        return Number.isFinite(cp) && cp > 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : m;
      }
      const k = e.toLowerCase();
      return k in NAMED ? NAMED[k] : m;
    })
    .replace(/\r\n?/g, "\n").replace(/[ \t\u00a0]+/g, " ")
    .split("\n").map((l) => l.trim()).join("\n")
    .replace(/\n{3,}/g, "\n\n").trim()
    .replace(/\s*submitted by\s+\/u\/[A-Za-z0-9_-]+\s*(?:\[link\]\s*)?(?:\[comments\]\s*)?$/, "")
    .trim();
}

const TODAY = new Date().toISOString().slice(0, 10);
const leads = [];
let missing = 0, eliminated = 0;

for (const j of judgments) {
  if (!j.pass) continue;
  const p = byId.get(j.id);
  if (!p) { console.error(`  no scraped post for ${j.id}`); missing++; continue; }
  const { score, tier } = scoreSig({ d: j.d, t: j.t, b: j.b, g: j.g, u: j.u });
  // Layer 3 can still eliminate a Layer 1 pass: no specific signal scores 0.
  if (tier === "Eliminated") { console.log(`  eliminated at Layer 3: ${j.id}`); eliminated++; continue; }
  leads.push({
    thread_id: p.id,
    source: p.source,
    title: (p.title || "").trim(),
    body: cleanBody(p.body) || null,
    url: (p.url || "").trim(),
    post_date: p.post_date || null,
    tier,
    score,
    scanned_on: TODAY,
  });
}

leads.sort((a, b) => b.score - a.score);
fs.writeFileSync("pending-leads.json", JSON.stringify(leads, null, 1));

const judged = judgments.length;
const passed = judgments.filter((j) => j.pass).length;
const tiers = leads.reduce((a, l) => (a[l.tier] = (a[l.tier] || 0) + 1, a), {});
const srcs = leads.reduce((a, l) => (a[l.source] = (a[l.source] || 0) + 1, a), {});
console.log(`\njudged ${judged}/${posts.length} · passed Layer 1 ${passed} · scored ${leads.length}` +
            (eliminated ? ` · eliminated ${eliminated}` : "") + (missing ? ` · missing ${missing}` : ""));
console.log("tiers  :", tiers);
console.log("sources:", srcs);
if (judged < posts.length) console.error(`\nWARNING: ${posts.length - judged} posts unjudged — classify them before importing.`);
console.log("\n-> pending-leads.json ready; run: npm run import");
