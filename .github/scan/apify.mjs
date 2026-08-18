/* Apify scraping. Both Reddit and TripAdvisor 403 datacenter IPs — Apify's
   RESIDENTIAL proxy is the only thing that gets through, so there is no free
   fallback here. Do not "simplify" this to plain fetch; it will 403. */

const TOKEN = process.env.APIFY_TOKEN;
const POLL_MS = 15_000;

async function runActor(actor, input) {
  const r = await fetch(`https://api.apify.com/v2/acts/${actor}/runs?token=${TOKEN}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!r.ok) throw new Error(`${actor} start ${r.status}: ${(await r.text()).slice(0, 400)}`);
  return (await r.json()).data;
}

async function waitFor(runId, { timeoutMs }) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const r = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${TOKEN}`);
    const d = (await r.json()).data;
    if (d.status !== "RUNNING" && d.status !== "READY") return d;
    if (Date.now() > deadline) {
      // Abort rather than let a wedged run keep billing.
      await fetch(`https://api.apify.com/v2/actor-runs/${runId}/abort?token=${TOKEN}`, { method: "POST" });
      const f = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${TOKEN}`);
      return (await f.json()).data;
    }
    await new Promise(s => setTimeout(s, POLL_MS));
  }
}

async function items(datasetId) {
  const r = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${TOKEN}&clean=true`);
  if (!r.ok) throw new Error(`dataset ${r.status}`);
  return r.json();
}

/* Pagination: insert -oN- right after the -i<digits>- segment. `?o=20` and
   `-oa20-` are both wrong (HANDOFF §5) — the latter silently returns almost
   nothing, which reads as "pagination doesn't help". */
const paged = (url, offset) => offset === 0 ? url : url.replace(/(-i\d+)-/, `$1-o${offset}-`);

const TA_INDEX_FN = `async function pageFunction(context){
  const {$, request} = context; const seen = {}; const rows = [];
  $('a[href*="ShowTopic"]').each(function(){
    const href = $(this).attr('href') || '';
    if (href.indexOf('#') !== -1) return;
    const m = href.match(/-k(\\d+)-/); if (!m) return;
    const kid = m[1]; if (seen[kid]) return;
    const title = $(this).text().trim(); if (!title || title.length < 4) return;
    seen[kid] = true;
    const rowText = $(this).closest('tr,li,div').text();
    const dm = rowText.match(/([A-Z][a-z]{2} \\d{1,2}, \\d{4})/);
    rows.push({ title, url: href.startsWith('http') ? href : 'https://www.tripadvisor.com'+href, date: dm ? dm[1] : null });
  });
  const fm = request.url.match(/ShowForum-\\w+-\\w+-(.+)\\.html/);
  return { sourceUrl: request.url, forum: fm ? fm[1] : '', topics: rows };
}`;

/* clean() must match THROUGH the trailing 'log_autolink_impression'); —
   the original regex assumed the reverse order and missed 20 of 26 pages. */
const TA_BODY_FN = `async function pageFunction(context){
  const {$, request} = context;
  const clean = s => s
    .replace(/\\(ta && ta\\.queueForLoad[\\s\\S]*?['"]log_autolink_impression['"]\\s*\\)\\s*;?/g,'')
    .replace(/\\(ta && ta\\.queueForLoad[\\s\\S]{0,400}?\\}\\s*\\)\\s*;?/g,'')
    .replace(/\\s+/g,' ').trim();
  let op = '';
  for (const sel of ['div.postBody','div.post-body','.postcontent','.b_2b8kR4YO']) {
    const el = $(sel).first(); if (el.length){ op = el.text().trim(); break; }
  }
  if (!op){ op = $('p').map(function(){return $(this).text().trim();}).get().filter(x=>x.length>40)[0] || ''; }
  return { url: request.url, title: $('h1').first().text().trim(), openingPost: clean(op).slice(0,1500) };
}`;

const PROXY = { useApifyProxy: true, apifyProxyGroups: ["RESIDENTIAL"] };

export async function taIndex(forums, { pages = 2 } = {}) {
  const startUrls = [];
  for (const f of forums) for (let p = 0; p < pages; p++) startUrls.push({ url: paged(f, p * 20) });
  const run = await runActor("apify~cheerio-scraper", {
    startUrls, proxyConfiguration: PROXY, maxRequestRetries: 4, maxConcurrency: 6,
    pageFunction: TA_INDEX_FN,
  });
  const done = await waitFor(run.id, { timeoutMs: 12 * 60_000 });
  return { rows: await items(run.defaultDatasetId), cost: done.usageTotalUsd || 0, status: done.status };
}

export async function taBodies(urls) {
  if (!urls.length) return { rows: [], cost: 0, status: "SKIPPED" };
  const run = await runActor("apify~cheerio-scraper", {
    startUrls: urls.map(url => ({ url })), proxyConfiguration: PROXY,
    maxRequestRetries: 4, maxConcurrency: 8, pageFunction: TA_BODY_FN,
  });
  const done = await waitFor(run.id, { timeoutMs: 20 * 60_000 });
  return { rows: await items(run.defaultDatasetId), cost: done.usageTotalUsd || 0, status: done.status };
}

/* postDateLimit is a real cost lever, not just a filter: out-of-window posts
   are dropped before the dataset, so they are never billed (verified
   2026-08-11 — 180 ignored posts cost $0). Set it to the last scan date and
   you pay only for genuinely new content. */
export async function reddit({ blanket, general, terms, since, maxItems }) {
  if (maxItems <= 0) return { rows: [], cost: 0, status: "SKIPPED" };
  const startUrls = [
    ...blanket.map(s => ({ url: `https://www.reddit.com/r/${s}/new/` })),
    ...general.flatMap(s => terms.map(t => ({
      url: `https://www.reddit.com/r/${s}/search/?q=${encodeURIComponent(t)}&restrict_sr=1&sort=new&t=year`,
    }))),
  ];
  const run = await runActor("trudax~reddit-scraper-lite", {
    startUrls, skipComments: true, skipUserPosts: true, skipCommunity: true,
    searchPosts: true, sort: "new", time: "year", includeNSFW: false,
    maxItems, maxPostCount: 25, postDateLimit: since,
    proxy: { useApifyProxy: true },
  });
  // Reddit throttles hard (~9 req/min under 429 backoff). Cap the wall clock;
  // an aborted run still yields everything written so far.
  const done = await waitFor(run.id, { timeoutMs: 25 * 60_000 });
  return { rows: await items(run.defaultDatasetId), cost: done.usageTotalUsd || 0, status: done.status };
}
