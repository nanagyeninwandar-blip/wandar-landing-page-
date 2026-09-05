import { extractDestinations } from "./destinations.mjs";
/* Supabase read/write. Service-role key — bypasses RLS; never ship it to a
   browser (the publishable key in feed/config.js is read-only by design). */

const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE;

/* The travel_date / travel_window_end / travel_precision columns from
   PENDING.md §3b are CODED BUT NOT MIGRATED — they do not exist on the live
   table. PostgREST rejects the WHOLE batch on an unknown column, so sending
   them means the scan silently writes nothing. Flip this with the migration. */
const TRAVEL_COLS_LIVE = false;

/* Flip to true in the SAME commit as 2026-09-05_destinations.sql. Sending a
   column that does not exist makes PostgREST reject the WHOLE batch (PGRST204)
   and the scan writes nothing — same trap TRAVEL_COLS_LIVE guards. The feed has
   a matching DEST_COLS_LIVE in app.js; both flip together. */
const DEST_COLS_LIVE = false;
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };

export async function existingThreadIds() {
  const ids = new Set();
  for (let from = 0; ; from += 1000) {
    const r = await fetch(`${URL}/rest/v1/leads?select=thread_id&limit=1000&offset=${from}`, { headers: H });
    if (!r.ok) throw new Error(`Supabase read ${r.status}: ${await r.text()}`);
    const rows = await r.json();
    rows.forEach(x => ids.add(x.thread_id));
    if (rows.length < 1000) return ids;
  }
}

/** Most recent scan date, used as Reddit's postDateLimit so we pay only for new posts. */
export async function lastScanDate() {
  const r = await fetch(`${URL}/rest/v1/leads?select=scanned_on&order=scanned_on.desc&limit=1`, { headers: H });
  if (!r.ok) return null;
  const rows = await r.json();
  return rows[0]?.scanned_on || null;
}

/* Seen-thread ledger. Without it we re-deep-scrape every thread we already
   judged and rejected — on 2026-08-11 that was 192 of 215 threads, re-paid
   for on every future run until they age out of the window.
   Stored as a JSON artifact by the workflow, not a table, so no migration. */
export function mergeSeen(seen, ids) {
  const out = new Set(seen);
  ids.forEach(i => out.add(i));
  return out;
}

const NAMED = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
export function cleanBody(s) {
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
    .replace(/\r\n?/g, "\n").replace(/[ \t ]+/g, " ")
    .split("\n").map(l => l.trim()).join("\n")
    .replace(/\n{3,}/g, "\n\n").trim()
    // Reddit appends this to EVERY body, entity-padded — so it must come after
    // the decode above, anchored to the end (a stray [link] mid-post is theirs).
    .replace(/\s*submitted by\s+\/u\/[A-Za-z0-9_-]+\s*(?:\[link\]\s*)?(?:\[comments\]\s*)?$/, "")
    .trim();
}

export async function writeLeads(leads) {
  if (!leads.length) return 0;
  const payload = leads.map(l => ({
    thread_id: l.id,
    source: l.source,
    title: (l.title || "").trim(),
    body: cleanBody(l.body) || null,
    url: (l.url || "").trim(),
    post_date: l.post_date || null,
    // Derived here so the column is never stale: the scan is the only writer.
    // Runs on the CLEANED body — raw text is entity-escaped and would miss words.
    ...(DEST_COLS_LIVE ? { destinations: extractDestinations(l.title, cleanBody(l.body), l.url) } : {}),
    ...(TRAVEL_COLS_LIVE ? { travel_date: null, travel_window_end: null, travel_precision: null } : {}),
    tier: l.tier,
    score: l.score,
    scanned_on: new Date().toISOString().slice(0, 10),
  }));
  const r = await fetch(`${URL}/rest/v1/leads?on_conflict=thread_id`, {
    method: "POST",
    headers: { ...H, Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(payload),
  });
  if (!r.ok) throw new Error(`Supabase write ${r.status}: ${await r.text()}`);
  return payload.length;
}

export async function leadCount() {
  const r = await fetch(`${URL}/rest/v1/leads?select=id&limit=1`, {
    headers: { ...H, Prefer: "count=exact", Range: "0-0" },
  });
  return Number((r.headers.get("content-range") || "0-0/0").split("/")[1]);
}
