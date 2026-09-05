/* ==================================================================
   Wandar — Live Opportunity Feed — front-end logic
   Works in two modes:
     • LIVE  — real Supabase (config.js has real keys): accounts + live leads.
     • DEMO  — no Supabase keys: sample-data.js + localStorage mock auth,
               so the whole prototype is clickable with zero setup.
   Active page is read from <body data-page="...">.
   ================================================================== */
(function () {
  "use strict";

  var CFG = window.WANDAR_CONFIG || {};
  var configured =
    CFG.SUPABASE_URL && CFG.SUPABASE_URL.indexOf("YOUR-PROJECT") === -1 &&
    CFG.SUPABASE_ANON_KEY && CFG.SUPABASE_ANON_KEY.indexOf("YOUR-ANON") === -1;

  var sb = (configured && window.supabase)
    ? window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY)
    : null;
  var DEMO = !sb;                       // prototype mode
  var SAMPLE = window.WANDAR_SAMPLE || { totals: { all: 0, reddit: 0, tripadvisor: 0 }, leads: [] };
  // NOTE 2026-08-08: a Post Date range filter (dd-daterange) was re-added here at the
  // user's explicit request, overriding an earlier removal from 2026-07-25. The
  // original reasoning still applies and is worth knowing before touching this again:
  // scans run twice weekly and can pause for weeks on Apify credit limits, so a date
  // WINDOW can make the feed look emptier than the DB actually is, and post age isn't
  // the same as lead decay (a January post about a Sept 2027 trip is still unbooked).
  // The counters above the table intentionally do NOT respect this filter — they stay
  // whole-database totals, same as they already ignore the Source filter.
  var DEMO_KEY = "wandar_demo_session";

  /* ----------------------------- helpers ----------------------------- */
  function $(s, r) { return (r || document).querySelector(s); }
  function $all(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function fmtDate(iso) {
    if (!iso) return "";
    var d = new Date(iso + (iso.length === 10 ? "T00:00:00" : ""));
    if (isNaN(d)) return iso;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  var GLYPH = {
    reddit: '<svg width="20" height="20" viewBox="0 0 24 24" fill="#fff"><circle cx="12" cy="13.2" r="8" fill="none" stroke="#fff" stroke-width="1.6"/><circle cx="9" cy="13" r="1.3"/><circle cx="15" cy="13" r="1.3"/><path d="M8.8 16.2c1.8 1.2 4.6 1.2 6.4 0" fill="none" stroke="#fff" stroke-width="1.4" stroke-linecap="round"/><circle cx="19.2" cy="9.6" r="1.8"/><circle cx="12" cy="5.2" r="1.6"/><path d="M13.4 5.6 18.2 8.6" stroke="#fff" stroke-width="1.3" stroke-linecap="round"/></svg>',
    tripadvisor: '<svg width="20" height="20" viewBox="0 0 24 24" fill="#000"><circle cx="8" cy="12" r="4.4" fill="none" stroke="#000" stroke-width="1.8"/><circle cx="16" cy="12" r="4.4" fill="none" stroke="#000" stroke-width="1.8"/><circle cx="8" cy="12" r="1.6"/><circle cx="16" cy="12" r="1.6"/></svg>',
  };
  var THUMB_UP = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M7 10v11"/><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H7a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L14 4a1.5 1.5 0 0 1 1 1.88z"/></svg>';
  // speech bubble — "Reply" replaces the old "View Original Post ↗" label; still just
  // opens the original thread in a new tab (that IS how an operator replies).
  var REPLY = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8z"/></svg>';
  var THUMB_DOWN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M17 14V3"/><path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H17a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L10 20a1.5 1.5 0 0 1-1-1.88z"/></svg>';

  function srcLabel(s) { return s === "reddit" ? "Reddit" : "Tripadvisor"; }

  /* Destination matching, mirrored from .github/scan/destinations.mjs. Kept in
     the browser because the `destinations` column does not exist yet: derive it
     from the text we already fetched rather than making the filter wait on a
     migration. Once DEST_COLS_LIVE flips, the query filters server-side and this
     becomes a fallback for rows the backfill has not reached.
     Multi-valued on purpose — "Kenya or Tanzania?" belongs under both. */
  var PLACES = {
  Tanzania: ["tanzania", "serengeti", "ngorongoro", "tarangire", "zanzibar", "arusha",
             "kilimanjaro", "ndutu", "lake manyara", "selous", "nyerere", "ruaha",
             "mikumi", "saadani", "stone town", "seronera", "grumeti", "singita"],
  Kenya: ["kenya", "masai mara", "maasai mara", "amboseli", "samburu", "nairobi",
          "tsavo", "laikipia", "naivasha", "nakuru", "meru national park", "diani",
          "lewa", "ol pejeta"],
  "South Africa": ["south africa", "kruger", "sabi sand", "sabi sabi", "cape town",
                   "madikwe", "phinda", "timbavati", "garden route", "johannesburg",
                   "marloth park", "hluhluwe", "addo", "londolozi", "singita sabi"],
  Botswana: ["botswana", "okavango", "chobe", "moremi", "kalahari", "linyanti",
             "savuti", "makgadikgadi", "maun", "khwai", "nxai"],
  Namibia: ["namibia", "sossusvlei", "etosha", "swakopmund", "damaraland", "deadvlei",
            "windhoek", "skeleton coast", "walvis bay", "waterberg"],
  Zimbabwe: ["zimbabwe", "victoria falls", "hwange", "mana pools", "bulawayo",
             "matobo", "gonarezhou"],
  Zambia: ["zambia", "luangwa", "livingstone", "kafue", "lower zambezi", "lusaka"],
  Uganda: ["uganda", "bwindi", "murchison", "kibale", "entebbe", "queen elizabeth",
           "kampala", "mabamba", "kidepo"],
  Rwanda: ["rwanda", "volcanoes national park", "kigali", "nyungwe", "akagera"],
};
  function leadDestinations(l) {
    if (l.destinations && l.destinations.length) return l.destinations;   // post-migration
    var hay = ((l.title || "") + " " + (l.body || "") + " " + (l.url || "")).toLowerCase();
    var out = [];
    for (var k in PLACES) {
      if (!Object.prototype.hasOwnProperty.call(PLACES, k)) continue;
      for (var i = 0; i < PLACES[k].length; i++) {
        if (hay.indexOf(PLACES[k][i]) !== -1) { out.push(k); break; }
      }
    }
    return out;
  }
  function tierClass(t) {
    return t === "High Intent" ? "tier-pill--high"
         : t === "Mid Intent"  ? "tier-pill--mid"
         : "tier-pill--low";
  }

  /* ---- lead feedback (like/dislike) — relevance signal Wandar collects ---- */
  var VOTES_KEY = "wandar_votes";
  function getVotes() { try { return JSON.parse(localStorage.getItem(VOTES_KEY) || "{}"); } catch (e) { return {}; } }
  function setVote(key, v) {
    var m = getVotes();
    if (m[key] === v) delete m[key]; else m[key] = v;   // toggle off if same
    localStorage.setItem(VOTES_KEY, JSON.stringify(m));
    if (!DEMO && m[key] !== undefined) {
      getUser(function (u) { sb.from("lead_feedback").insert({ lead_url: key, vote: v, user_id: u ? u.id : null }); });
    }
    return m[key] || null;
  }

  /* ----------------------------- session (live + demo) ----------------------------- */
  function demoSession() { try { return JSON.parse(localStorage.getItem(DEMO_KEY) || "null"); } catch (e) { return null; } }
  function demoSetSession(u) { localStorage.setItem(DEMO_KEY, JSON.stringify(u)); }
  function demoClear() { localStorage.removeItem(DEMO_KEY); }

  function getSession(cb) {
    if (DEMO) { cb(demoSession()); return; }
    sb.auth.getSession().then(function (r) { cb(r.data.session); });
  }
  function getUser(cb) {
    if (DEMO) { cb(demoSession()); return; }
    sb.auth.getUser().then(function (r) { cb(r.data.user); });
  }
  function signOut() {
    if (DEMO) { demoClear(); location.href = CFG.AUTH_URL || "auth.html"; return; }
    sb.auth.signOut().then(function () { location.href = CFG.HOME_URL || "index.html"; });
  }

  /* ----------------------------- counters ----------------------------- */
  function loadCounters() {
    var els = { all: $("[data-counter='all']"), reddit: $("[data-counter='reddit']"), tripadvisor: $("[data-counter='tripadvisor']") };
    if (!els.all && !els.reddit && !els.tripadvisor) return;
    function set(c) {
      if (els.all) els.all.textContent = c.all.toLocaleString();
      if (els.reddit) els.reddit.textContent = c.reddit.toLocaleString();
      if (els.tripadvisor) els.tripadvisor.textContent = c.tripadvisor.toLocaleString();
    }
    var vt = viewTier();
    if (DEMO) {
      // derive from the rows we actually render, so the cards can never claim a
      // total the feed can't show (they used to: 238 hardcoded vs 60 sample rows)
      var L = (SAMPLE.leads || []).filter(notExpiredRow).filter(function (l) {
        return !vt || l.tier === vt;
      });
      set(L.length ? {
        all: L.length,
        reddit: L.filter(function (l) { return l.source === "reddit"; }).length,
        tripadvisor: L.filter(function (l) { return l.source === "tripadvisor"; }).length,
      } : SAMPLE.totals);
      return;
    }
    function count(src) {
      var q = notExpired(sb.from("leads").select("*", { count: "exact", head: true }));
      if (src) q = q.eq("source", src);
      if (vt) q = q.eq("tier", vt);            // the view, not the Intent filter
      return q.then(function (r) { return r.count || 0; });
    }
    Promise.all([count(null), count("reddit"), count("tripadvisor")]).then(function (c) {
      set({ all: c[0], reddit: c[1], tripadvisor: c[2] });
    });
  }

  /* ----------------------------- feed ----------------------------- */
  // Signing in shows every lead matching the current Source + Date range filters,
  // newest first. sortDir is toggled only by the "Date Posted" column header.
  /* `view` is a different axis from the filters: it changes which leads exist on
     screen at all (Lead Feed = everything, High Intent = tier "High Intent"),
     where source/intent/dateRange/q narrow whatever the view returned. */
  var feedState = { view: "feed", source: "all", intent: "all", destinations: [], band: "all", sortDir: "desc", dateRange: "all", q: "" };
  var NAV_KEY = "wandar_nav_collapsed";
  var VIEWS = {
    feed: { title: "Live Demand Feed", tier: null },
    high: { title: "High Intent", tier: "High Intent" },
  };
  function viewTier() { return VIEWS[feedState.view].tier; }

  /* Score bands for the High Intent tabs. No 8.0-8.4 "Warm" band: scoreSig can
     only ever return 4.5, 6.5, 7, 8.5, 9 or 10, so that range is unreachable by
     arithmetic and a tab for it would read (0) permanently. */
  var BANDS = {
    all:     { label: "All",              min: null, max: null },
    veryhot: { label: "Very Hot (9.0+)",  min: 9,    max: null },
    hot:     { label: "Hot (8.5 - 8.9)",  min: 8.5,  max: 9 },
  };
  function applyBand(q) {
    var b = BANDS[feedState.band] || BANDS.all;
    if (b.min !== null) q = q.gte("score", b.min);
    if (b.max !== null) q = q.lt("score", b.max);
    return q;
  }
  function bandMatch(l) {
    var b = BANDS[feedState.band] || BANDS.all;
    if (typeof l.score !== "number") return b.min === null;
    return (b.min === null || l.score >= b.min) && (b.max === null || l.score < b.max);
  }

  /* Post Date range filter (dd-daterange). "all" = no cutoff (default — matches the
     pre-2026-08-08 behavior of showing every lead). "year" = calendar-year-to-date
     (Jan 1). The rest are a rolling N-day window ending today. */
  function dateRangeCutoff(val) {
    if (val === "all") return null;
    var now = new Date();
    if (val === "year") return new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10);
    var days = parseInt(val, 10) || 7;
    return new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  }

  /* The one date rule the feed intends to apply, and it is NOT a recency filter: a
     lead whose TRIP has already happened is dead and gets hidden. `travel_window_end`
     is the last plausible day of travel, extracted from the post itself. Rows with no
     stated date have NULL here and are kept forever — we can't prove they're dead.
     This is what lets us keep showing a January post about a 2027 safari while
     dropping a June post about a July trip.

     BUG FOUND 2026-08-08: the live `leads` table does not actually have this column —
     PENDING.md §3b's SQL migration was written but never run. Filtering on it 400s
     ("column leads.travel_window_end does not exist"), and supabase-js RESOLVES
     rather than throws on a PostgREST error, so `r.count || 0` / `r.data || []`
     silently turned that failure into "the feed has zero leads" everywhere this was
     applied — counters included, breaking the live site for every signed-in user.
     Disabled here until the migration actually runs; flip TRAVEL_EXPIRY_LIVE to true
     that day (the query code is already correct, it was only ever a schema gap). */
  var TRAVEL_EXPIRY_LIVE = false;

  /* Destination filter. Flip to true in the SAME commit as the destinations
     migration + backfill — selecting or filtering a column that does not exist
     400s the whole query and the feed shows nothing. Mirrors DEST_COLS_LIVE in
     .github/scan/supabase.mjs; both flip together. */
  var DEST_COLS_LIVE = false;
  var TODAY = new Date().toISOString().slice(0, 10);
  function notExpired(q) {
    return TRAVEL_EXPIRY_LIVE ? q.or("travel_window_end.is.null,travel_window_end.gte." + TODAY) : q;
  }
  function notExpiredRow(l) {
    return !l.travel_window_end || l.travel_window_end >= TODAY;
  }

  function sortRows(rows) {
    return rows.slice().sort(function (a, b) {
      if (a.post_date === b.post_date) return 0;
      var asc = a.post_date > b.post_date ? 1 : -1;
      return feedState.sortDir === "asc" ? asc : -asc;
    });
  }

  /* Sort direction lives here only. Its single entry point is the "Date Posted" column
     header — there is no separate sort pill by design (see the feed-bar comment in
     app.html). This is independent of the Date range FILTER (feedState.dateRange),
     which narrows which rows exist in allRows in the first place. */
  function setSort(dir) {
    feedState.sortDir = dir === "asc" ? "asc" : "desc";
    loadFeed();          // the Sort pill shows the direction; there is no caret now
  }

  function demoLeads(source) {
    var cutoff = dateRangeCutoff(feedState.dateRange);
    var vt = viewTier();
    return SAMPLE.leads.filter(function (l) {
      return (source === "all" || l.source === source) && notExpiredRow(l) &&
        (!vt || l.tier === vt) &&
        (feedState.intent === "all" || l.tier === feedState.intent) &&
        (feedState.view !== "high" || bandMatch(l)) &&
        (!cutoff || (l.post_date && l.post_date >= cutoff));
    });
  }
  function liveLeads(source) {
    var cutoff = dateRangeCutoff(feedState.dateRange);
    // travel_window_end isn't a real column yet either (see the notExpired comment
    // above) — selecting a nonexistent column 400s independently of the WHERE filter.
    var cols = "id,source,title,body,url,post_date,tier,score" + (TRAVEL_EXPIRY_LIVE ? ",travel_window_end" : "");
    var q0 = sb.from("leads").select(cols)
      .order("post_date", { ascending: feedState.sortDir === "asc" }).limit(2000);
    if (cutoff) q0 = q0.gte("post_date", cutoff);
    var q = notExpired(q0);
    if (source !== "all") q = q.eq("source", source);
    // The view wins over the Intent pill: on High Intent the pill is hidden, so
    // a stale feedState.intent from the other view can never narrow it further.
    var vt = viewTier();
    if (vt) q = q.eq("tier", vt);
    else if (feedState.intent !== "all") q = q.eq("tier", feedState.intent);
    // contains, not equals: destinations is an array and a lead can name several.
    // overlaps = "shares any value with", the array equivalent of the ANY above.
    if (DEST_COLS_LIVE && feedState.destinations.length) q = q.overlaps("destinations", feedState.destinations);
    if (feedState.view === "high") q = applyBand(q);       // tabs exist only there
    return q.then(function (r) { return r.data || []; });
  }

  var PAGE_SIZE = 25;
  var fetchedRows = [];  // what Source + Date range returned, before the text search
  var allRows = [];      // full filtered + sorted set
  var page = 1;

  /* The text search runs in the browser over the rows already fetched (500 max),
     so typing never costs a round trip and never fights the pill filters: it
     narrows whatever those two left behind. Matches title and body. */
  function searchRows(rows) {
    var q = feedState.q, dests = feedState.destinations;
    if (!q && !dests.length) return rows;
    return rows.filter(function (l) {
      if (q && ((l.title || "") + " " + (l.body || "")).toLowerCase().indexOf(q) === -1) return false;
      if (dests.length) {
        // ANY, not ALL: picking Kenya + Tanzania asks for either, which is also
        // how a lead naming both is already counted under each.
        var d = leadDestinations(l);
        var hit = false;
        for (var i = 0; i < dests.length; i++) if (d.indexOf(dests[i]) !== -1) { hit = true; break; }
        if (!hit) return false;
      }
      return true;
    });
  }

  function loadFeed() {
    var body = $("#feed-body");
    if (!body) return;
    if (DEMO) { setRows(sortRows(demoLeads(feedState.source))); return; }
    body.innerHTML = '<tr><td colspan="2" class="feed-empty">Loading opportunities…</td></tr>';
    liveLeads(feedState.source).then(function (rows) { setRows(sortRows(rows)); }).catch(function (e) {
      body.innerHTML = '<tr><td colspan="2" class="feed-empty">Could not load leads. ' + esc(e.message || "") + '</td></tr>';
    });
  }

  function setRows(rows) { fetchedRows = rows; applySearch(); }
  function applySearch() { allRows = searchRows(fetchedRows); page = 1; renderPage(); }

  /* Only the pager's "↑ Top" button scrolls. Prev/Next intentionally leave the scroll
     position where it is. */
  function scrollToTop() {
    var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    try { window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" }); }
    catch (e) { window.scrollTo(0, 0); }        // older browsers: no options object
  }
  function goPage(p) { page = p; renderPage(); }

  function renderPage() {
    var total = allRows.length;
    var totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    if (page > totalPages) page = totalPages;
    var start = (page - 1) * PAGE_SIZE;
    var slice = allRows.slice(start, start + PAGE_SIZE);

    renderRows(slice, start);

    var count = $("#feed-count");
    if (count) {
      count.innerHTML = total === 0 ? "Showing <b>0</b> leads"
        : "Showing <b>" + (start + 1) + "–" + (start + slice.length) + "</b> of <b>" + total + "</b> leads";
    }
    var pager = $("#pager"), info = $("#pager-info"), prev = $("#pager-prev"), next = $("#pager-next");
    if (pager) {
      if (total <= PAGE_SIZE) { pager.style.display = "none"; }
      else {
        pager.style.display = "flex";
        if (info) info.textContent = "Page " + page + " of " + totalPages;
        if (prev) prev.disabled = page <= 1;
        if (next) next.disabled = page >= totalPages;
      }
    }
  }

  function renderRows(rows, offset) {
    var body = $("#feed-body");
    if (!rows.length) {
      body.innerHTML = feedState.q
        ? '<tr><td colspan="2" class="feed-empty">No leads match <b>' + esc(feedState.q) + '</b>. Try a different search, a wider <b>Date range</b> or <b>All Sources</b>.</td></tr>'
        : '<tr><td colspan="2" class="feed-empty">No leads match these filters. Try a wider <b>Date range</b> or <b>All Sources</b>.</td></tr>';
      return;
    }
    var votes = getVotes();
    body.innerHTML = rows.map(function (r, i) {
      var src = (r.source === "reddit") ? "reddit" : "tripadvisor";
      var key = r.url, v = votes[key];
      // title and body are separate blocks so each clamps on its own
      // (1 line for the title, 3 for the body) — see .ft-title / .ft-body
      var bodyHtml = r.body ? '<div class="ft-body">' + esc(r.body) + '</div>' : "";
      // Score and tier only landed in the query in Sep 2026; a row without them
      // renders the rest of itself rather than printing "null/10".
      var scoreHtml = (typeof r.score === "number")
        ? '<div class="feed__score">' +
            '<span class="feed__score-num">' + r.score.toFixed(1) + '</span>' +
            '<span class="feed__score-den">/10</span>' +
            (r.tier ? '<div class="tier-pill ' + tierClass(r.tier) + '">' + esc(r.tier) + '</div>' : "") +
          '</div>'
        : '<div class="feed__score"></div>';
      return '' +
        '<tr data-idx="' + (offset + i) + '">' +
          '<td><div class="feed__post">' +
            // Badge only — the glyph already says Reddit vs Tripadvisor, and the
            // word repeated down every row was noise. title= keeps it accessible.
            '<span class="src-badge ' + src + '" title="' + esc(srcLabel(src)) + '">' + GLYPH[src] + '</span>' +
            scoreHtml +
            '<div class="feed__text"><div class="ft-title">' + esc(r.title) + '</div>' + bodyHtml + '</div>' +
            '<div class="feed__fb" data-key="' + esc(key) + '">' +
              '<button class="fb up' + (v === "up" ? " active" : "") + '" data-vote="up" title="Relevant lead" aria-label="Relevant">' + THUMB_UP + '</button>' +
              '<button class="fb down' + (v === "down" ? " active" : "") + '" data-vote="down" title="Not relevant" aria-label="Not relevant">' + THUMB_DOWN + '</button>' +
            '</div>' +
            '<a class="feed__reply" href="' + esc(r.url) + '" target="_blank" rel="noopener noreferrer" title="Open the original post to reply">' + REPLY + 'Reply</a>' +
          '</div></td>' +
          '<td class="feed__date">' + esc(fmtDate(r.post_date)) + '</td>' +
        '</tr>';
    }).join("");
  }

  /* ----------------------------- lead side panel ----------------------------- */
  function castVote(key, voteVal) {
    var now = setVote(key, voteVal);
    $all(".feed__fb").forEach(function (g) {
      if (g.getAttribute("data-key") === key) {
        $all(".fb", g).forEach(function (b) { b.classList.toggle("active", b.getAttribute("data-vote") === now); });
      }
    });
  }

  function openPanel(L) {
    if (!L) return;
    var src = (L.source === "reddit") ? "reddit" : "tripadvisor";
    var badge = $("#lp-badge"); badge.className = "src-badge " + src; badge.innerHTML = GLYPH[src];
    $("#lp-src").textContent = srcLabel(src);
    $("#lp-date").textContent = " •  " + fmtDate(L.post_date);
    $("#lp-title").textContent = L.title;
    $("#lp-post").textContent = L.body || "Open the original post to read the full thread.";
    $("#lp-note").textContent = L.body ? "" : "";
    $("#lp-view").href = L.url;
    var fb = $("#lp-fb"); fb.setAttribute("data-key", L.url);
    var v = getVotes()[L.url];
    $all(".fb", fb).forEach(function (b) { b.classList.toggle("active", b.getAttribute("data-vote") === v); });
    $("#lead-panel").classList.add("open");
    syncScrollLock();                                 // freeze the page behind the panel
    var sb2 = $(".sidepanel__body"); if (sb2) sb2.scrollTop = 0;   // always open at the top
  }
  function closePanel() {
    var p = $("#lead-panel"); if (p) p.classList.remove("open");
    syncScrollLock();
  }

  /* The page-scroll lock has ONE owner. Both the lead panel and any modal sit on
     a fixed overlay, so the page behind must freeze — otherwise a wheel/trackpad
     scroll slides the background under a stationary dialog. They can also overlap
     (Escape closes the panel while a modal is open), so derive the lock from what
     is actually open instead of add/remove-ing blindly, or the first thing to
     close unlocks the page for the one still on screen.
     html{scrollbar-gutter:stable} reserves the gutter, so locking never shifts
     the layout sideways. */
  function syncScrollLock() {
    var panel = $("#lead-panel");
    var locked = !!$(".modal-overlay.open") || !!(panel && panel.classList.contains("open"));
    document.body.classList.toggle("panel-open", locked);
  }

  /* ----------------------------- profile menu ----------------------------- */
  function initProfileMenu(user) {
    var chip = $("#profile-chip"), menu = $("#profile-menu");
    if (user) {
      var email = user.email || "";
      var meta = user.user_metadata || user;   // live user_metadata OR demo object
      var company = meta.company || "";
      var name = meta.full_name || meta.name || email.split("@")[0] || "Account";
      var initials = name.split(/[\s.]+/).map(function (w) { return w[0]; }).join("").slice(0, 2).toUpperCase();
      $all("[data-user-name]").forEach(function (el) { el.textContent = name; });
      $all("[data-user-sub]").forEach(function (el) { el.textContent = company || "Safari Operator"; });
      $all("[data-user-email]").forEach(function (el) { el.textContent = email; });
      $all("[data-user-initials]").forEach(function (el) { el.textContent = initials || "W"; });
    }
    if (!chip || !menu) return;
    chip.addEventListener("click", function (e) { e.stopPropagation(); menu.classList.toggle("open"); });
    document.addEventListener("click", function () { menu.classList.remove("open"); });
    menu.addEventListener("click", function (e) { e.stopPropagation(); });
  }

  /* ----------------------------- modals ----------------------------- */
  function openModal(id) { var m = $("#" + id); if (m) m.classList.add("open"); syncScrollLock(); }
  function closeModal(id) { var m = $("#" + id); if (m) m.classList.remove("open"); syncScrollLock(); }
  function initModals() {
    $all("[data-open]").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        if (btn.hasAttribute("data-close")) closeModal(btn.getAttribute("data-close"));
        openModal(btn.getAttribute("data-open"));
        var m = $("#profile-menu"); if (m) m.classList.remove("open");
      });
    });
    $all("[data-close]:not([data-open])").forEach(function (btn) {
      btn.addEventListener("click", function () { closeModal(btn.getAttribute("data-close")); });
    });
    $all(".modal-overlay").forEach(function (ov) {
      ov.addEventListener("click", function (e) { if (e.target === ov) { ov.classList.remove("open"); syncScrollLock(); } });
    });
    var form = $("#early-access-form");
    if (form) {
      // "Something else" reveal
      var goalSel = $("#ea-goal", form), goalOther = $("#ea-goal-other", form);
      if (goalSel) goalSel.addEventListener("change", function () {
        if (goalOther) goalOther.classList.toggle("visible", goalSel.value === "other");
      });
      // tool checkboxes with nested selects (CRM / Booking)
      $all("input[data-nested]", form).forEach(function (chk) {
        chk.addEventListener("change", function () {
          var nest = $("#ea-nest-" + chk.getAttribute("data-nested"), form);
          if (nest) nest.classList.toggle("visible", chk.checked);
        });
      });

      form.addEventListener("submit", function (e) {
        e.preventDefault();
        var msg = $("#ea-msg", form);
        var emailEl = $("#ea-email", form), companyEl = $("#ea-company", form), roleEl = $("#ea-role", form), goalEl = $("#ea-goal", form);
        var email = emailEl.value.trim();
        function bad(el, is) { if (el) el.classList.toggle("mf-input--err", !!is); return is; }

        var missing = false;
        if (!EMAIL_RE.test(email)) { bad(emailEl, true); missing = true; } else bad(emailEl, false);
        if (!companyEl.value.trim()) { bad(companyEl, true); missing = true; } else bad(companyEl, false);
        if (!roleEl.value) { bad(roleEl, true); missing = true; } else bad(roleEl, false);
        if (!goalEl.value) { bad(goalEl, true); missing = true; } else bad(goalEl, false);
        if (missing) { showMsg(msg, "error", "Please fill in the required fields."); return; }

        // collect tools
        var tools = [];
        $all(".mf-check-row input[type=checkbox]", form).forEach(function (chk) {
          if (!chk.checked) return;
          var key = chk.getAttribute("data-nested");
          if (key === "crm") { var v = ($("#ea-crm", form) || {}).value; tools.push("CRM" + (v ? ": " + v : "")); }
          else if (key === "booking") { var b = ($("#ea-booking", form) || {}).value; tools.push("Booking" + (b ? ": " + b : "")); }
          else if (chk.value) tools.push(chk.value);
        });
        var goal = goalEl.value === "other" ? (($("#ea-goal-other input", form) || {}).value || "Something else") : goalEl.value;
        var payload = { email: email, company: companyEl.value.trim(), role: roleEl.value, goal: goal, tools: tools.join(", ") };

        if (DEMO) {
          var botD = $('input[name="bot-field"]', form);
          netlifySubmit("early-access", {
            email: payload.email, company: payload.company,
            role: payload.role, goal: payload.goal, tools: payload.tools,
          }, botD ? botD.value : "");
          form.style.display = "none";
          var okD = $("#ea-success"); if (okD) okD.classList.add("visible");
          return;
        }
        // Both destinations, on purpose: Netlify Forms is where the landing
        // page's signups land, Supabase is where the feed's always have.
        var bot = $('input[name="bot-field"]', form);
        netlifySubmit("early-access", {
          email: payload.email, company: payload.company,
          role: payload.role, goal: payload.goal, tools: payload.tools,
        }, bot ? bot.value : "");

        getUser(function (u) {
          payload.user_id = u ? u.id : null;
          sb.from("waitlist").insert(payload)
            // "check your inbox" promised mail that is never sent — no welcome
            // email is wired (PENDING.md §2) and this page sends none by design.
            .then(function (r) {
              if (r.error) { showMsg(msg, "error", r.error.message); return; }
              form.style.display = "none";                       // landing behaviour:
              var ok = $("#ea-success"); if (ok) ok.classList.add("visible");   // form -> tick
            });
        });
      });
    }
  }
  /* Mirror of assets/js/modals.js netlifySubmit(). Netlify Forms only accepts
     the field names declared by the hidden <form name="early-access"> on
     index.html — email, company, role, goal, tools — so send exactly those.
     The POST goes to "/" on this origin, which is the Netlify site in
     production and simply 404s on a local dev server: it is fire-and-forget and
     never gates the UI, because Supabase is the record of truth here. */
  function netlifySubmit(formName, data, botField) {
    var body = new URLSearchParams();
    body.set("form-name", formName);
    body.set("bot-field", botField || "");
    Object.keys(data).forEach(function (k) { body.set(k, data[k] == null ? "" : String(data[k])); });
    return fetch("/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    }).catch(function () { /* offline, local dev, or Netlify down — never block */ });
  }

  function showMsg(el, kind, text) {
    if (!el) return;
    el.textContent = text;
    // #ea-msg is a .mf-err in the ported modal; auth.html still uses .form-msg.
    if (el.id === "ea-msg") el.className = "mf-err" + (kind === "ok" ? " mf-ok" : "");
    else el.className = "form-msg show " + kind;
  }

  /* ----------------------------- page: auth ----------------------------- */
  /* PASSWORDLESS BY DESIGN (2026-08-09). The landing page's "See live demand"
     field hands us the email in ?email=; the operator fills in who they are and
     lands in the feed on the first click. A real Supabase account is still
     created — with a random password they never see and never need, because the
     session cookie is what gates app.html.

     The one path that needs their inbox is a returning user on a NEW device: no
     password exists to type, so view B mails them a magic link instead. Keep
     "Confirm email" OFF in Supabase (see web/README.md §1b) — that's what makes
     signUp() return a session immediately and keeps the happy path one click. */
  function initAuthPage() {
    var form = $("#auth-form"); if (!form) return;

    var emailEl = $("#auth-email");
    var firstEl = $("#auth-first"), lastEl = $("#auth-last");
    var companyEl = $("#auth-company"), roleEl = $("#auth-role"), newsEl = $("#auth-newsletter");
    var consentWrap = newsEl.closest(".consent");
    var formMsg = $("#auth-msg"), submit = $("#auth-submit");

    // The email field on this page is the source of truth. ?email= is only a
    // convenience: when the landing page already collected an address it prefills
    // the field, and a returning operator is recognised from it on load.
    var heroEmail = (new URLSearchParams(location.search).get("email") || "").trim();
    if (heroEmail) emailEl.value = heroEmail;

    /* Hold the card back while we work out whether this person is already an
       operator. Without this a returning visitor sees the signup form flash up
       before the redirect fires. Applied from JS, never from the HTML, and with
       a hard timer behind it — if anything below throws or hangs, the form still
       appears rather than leaving a blank page. */
    var card = $(".auth-card");
    var revealTimer = setTimeout(reveal, 4000);
    if (card) card.classList.add("is-checking");
    function reveal() { clearTimeout(revealTimer); if (card) card.classList.remove("is-checking"); }

    /* Decide who this visitor is. An existing session carries a returning
       operator straight to the feed — but ONLY if the hero didn't name someone
       else.

       Typing an address into the hero is an explicit "this is who I am", and it
       has to beat a leftover session. It didn't until 2026-08-09: on a shared or
       previously-used browser, operator B typed their own address and was shown
       operator A's feed, signed in as A — and because the redirect fired before
       any signup could happen, B's account was never created and the lead was
       lost silently. Compare the two before trusting the session.

       This MUST also resolve before the no-email bounce below. getSession is
       async; when the bounce ran first (synchronously) a signed-in visitor
       opening a bare /auth.html was thrown out to the marketing page instead of
       their feed. Keep all of these decisions in this one callback. */
    getSession(function (s) {
      var sessionEmail = ((s && s.user && s.user.email) || (s && s.email) || "").toLowerCase();
      var typed = heroEmail.toLowerCase();

      if (s && (!typed || sessionEmail === typed)) {
        location.replace(CFG.FEED_URL || "app.html");     // same person, or no claim made
        return;
      }
      if (s) {                                            // a DIFFERENT person is claiming this browser
        signOutQuiet(function () { identify(); });
        return;
      }
      identify();
    });

    // Drops the current session without navigating, unlike the shared signOut().
    function signOutQuiet(cb) {
      if (DEMO) { demoClear(); cb(); return; }
      sb.auth.signOut().then(cb, cb);
    }

    function identify() {
      // Arriving without ?email= is a normal entry point (bookmark, shared link,
      // "Log In"): show the form and let them type the address themselves.
      if (!EMAIL_RE.test(heroEmail)) { reveal(); emailEl.focus(); return; }

      // This device might still belong to someone who signed up on another one.
      // Ask the server before making them fill the form.
      heroSignIn(heroEmail, function (ok) {
        if (ok) return;                       // heroSignIn has navigated to the feed
        reveal();
        firstEl.focus();                      // new operator — email came from the hero
      });
    }

    /* Returning operator on a device with no session. The hero-signin Edge
       Function tells us whether this email is already registered and, if it is,
       hands back a one-shot token we exchange for a session — so they land in
       the feed without retyping anything.

       Fails SOFT on purpose: if the function isn't deployed yet, is down, or is
       slow, cb(false) just shows the signup form, which is exactly the old
       behaviour. Never leave the visitor staring at a blank page. */
    function heroSignIn(email, cb) {
      var url = CFG.HERO_SIGNIN_URL;
      if (DEMO || !url || !EMAIL_RE.test(email)) { cb(false); return; }

      var done = false;
      var finish = function (v) { if (!done) { done = true; cb(v); } };
      var timer = setTimeout(function () { finish(false); }, 3500);

      fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: CFG.SUPABASE_ANON_KEY },
        body: JSON.stringify({ email: email })
      })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (d) {
          if (!d || !d.known || !d.token_hash) { clearTimeout(timer); finish(false); return; }
          return sb.auth.verifyOtp({ token_hash: d.token_hash, type: "magiclink" }).then(function (res) {
            clearTimeout(timer);
            if (res.error || !res.data || !res.data.session) { finish(false); return; }
            finish(true);
            location.replace(CFG.FEED_URL || "app.html");
          });
        })
        .catch(function () { clearTimeout(timer); finish(false); });
    }

    function markInvalid(el, bad) { var w = el && el.closest(".authfield"); if (w) w.classList.toggle("invalid", !!bad); }

    /* ---- the consent tick is what un-greys Sign in ---- */
    function syncGate() {
      submit.disabled = !newsEl.checked;
      if (newsEl.checked) consentWrap.classList.remove("invalid");
    }
    newsEl.addEventListener("change", syncGate);
    syncGate();

    [emailEl, firstEl, lastEl, companyEl, roleEl].forEach(function (el) {
      el.addEventListener("input", function () { markInvalid(el, false); });
      el.addEventListener("change", function () { markInvalid(el, false); });
    });

    /* A password the user never sees. 24 printable chars ≈ 150 bits — the account
       is only ever reachable through a session cookie or a hero-signin token. */
    function randomPassword() {
      var bytes = new Uint8Array(24);
      window.crypto.getRandomValues(bytes);
      var s = "";
      for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(33 + (bytes[i] % 94));
      return s;
    }
    // Supabase reports a taken email either as a 422 error or — when it is being
    // careful about account enumeration — as a "user" with zero identities.
    function isExistingUser(res) {
      var e = res.error;
      if (e && (e.code === "user_already_exists" || /already registered|already exists/i.test(e.message || ""))) return true;
      var u = res.data && res.data.user;
      return !!(u && u.identities && u.identities.length === 0);
    }
    function setBusy(on, label) {
      submit.disabled = on || !newsEl.checked;
      submit.textContent = on ? (label || "Working…") : "Sign in";
    }
    /* ---- create the account ---- */
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var email = emailEl.value.trim();           // typed here, or prefilled from ?email=
      var first = firstEl.value.trim(), last = lastEl.value.trim();
      var company = companyEl.value.trim(), role = roleEl.value;
      var fullName = (first + " " + last).trim();

      // The button is disabled until this is ticked; this is the belt to that braces.
      if (!newsEl.checked) { consentWrap.classList.add("invalid"); return; }

      var badEmail = !EMAIL_RE.test(email);
      markInvalid(emailEl, badEmail);
      if (badEmail) { showMsg(formMsg, "error", "Please enter a valid work email address."); emailEl.focus(); return; }

      var missing = false;
      [[firstEl, first], [lastEl, last], [companyEl, company], [roleEl, role]].forEach(function (p) {
        var bad = !p[1]; markInvalid(p[0], bad); if (bad) missing = true;
      });
      if (missing) { showMsg(formMsg, "error", "Please fill in your name, company, and role."); return; }

      var meta = {
        full_name: fullName, first_name: first, last_name: last,
        company: company, role: role,
        // consent record lives in user metadata — schemaless, so no migration and
        // nothing here can reference a column that was never created.
        newsletter: true, newsletter_opt_in_at: new Date().toISOString()
      };

      if (DEMO) {
        demoSetSession({ email: email, full_name: fullName, company: company, role: role });
        location.href = CFG.FEED_URL || "app.html";
        return;
      }

      setBusy(true, "Opening your feed…");
      sb.auth.signUp({ email: email, password: randomPassword(), options: { data: meta } }).then(function (res) {
        if (res.error || isExistingUser(res)) {
          if (!isExistingUser(res)) { setBusy(false); showMsg(formMsg, "error", res.error.message); return; }
          /* Already registered. Normally hero-signin catches this at page load and
             they never see the form, so getting here means it was unavailable then
             — retry it. If it still fails there is nothing left to offer: nothing
             on this page may send mail, so say so plainly rather than dead-ending. */
          heroSignIn(email, function (ok) {
            if (ok) return;                    // navigated to the feed
            setBusy(false);
            showMsg(formMsg, "error", "You already have a Wandar account, but we couldn't open your feed just now. Please try again in a moment.");
          });
          return;
        }
        var uid = res.data.user ? res.data.user.id : null;
        var go = function () {
          if (res.data.session) { location.href = CFG.FEED_URL || "app.html"; return; }
          /* No instant session means "Confirm email" was switched back on in
             Supabase. The account exists now, so mint a session for it rather
             than sending them to an inbox. */
          heroSignIn(email, function (ok) {
            if (ok) return;
            setBusy(false);
            showMsg(formMsg, "error", "Your account was created, but we couldn't open your feed just now. Please try again in a moment.");
          });
        };
        // Land the waitlist row BEFORE navigating away; a fire-and-forget insert
        // gets cancelled by the redirect and the signup vanishes from the list.
        sb.from("waitlist")
          .insert({ email: email, name: fullName, company: company, role: role, user_id: uid })
          .then(go, go);
      });
    });
  }

  /* ----------------------------- custom dropdown ----------------------------- */
  // <div class="dd" data-default data-prefix><button.dd__btn><span.dd__text/></button>
  //   <div class="dd__menu"><button.dd__opt data-val>Label</button>…</div></div>
  /* data-multi turns a .dd into a checklist: options toggle, the menu stays open
     while you pick, and the "all" option doubles as Clear. onChange then receives
     an ARRAY of values ([] meaning no restriction) instead of a single string. */
  function initDropdown(el, onChange) {
    if (!el) return;
    var btn = $(".dd__btn", el), textEl = $(".dd__text", el), menu = $(".dd__menu", el);
    var prefix = el.getAttribute("data-prefix") || "";
    var multi = el.hasAttribute("data-multi");
    var opts = $all(".dd__opt", el);
    var allOpt = opts.filter(function (o) { return o.getAttribute("data-val") === "all"; })[0];
    var noun = el.getAttribute("data-noun") || "selected";

    function chosen() {
      return opts.filter(function (o) {
        return o !== allOpt && o.classList.contains("selected");
      }).map(function (o) { return o.getAttribute("data-val"); });
    }

    function syncLabel() {
      var v = chosen();
      // One pill can't show nine country names, so past two it counts them.
      textEl.textContent = prefix + (
        // With a chip row below, the pill has nothing to report but on/off.
        el.hasAttribute("data-static-label") ? (allOpt ? allOpt.textContent : "All") :
        v.length === 0 ? (allOpt ? allOpt.textContent : "All") :
        v.length === 1 ? v[0] :
        v.length + " " + noun);
      if (allOpt) allOpt.classList.toggle("selected", v.length === 0);
      el.classList.toggle("dd--on", v.length > 0);
    }

    function selectSingle(opt, fire) {
      opts.forEach(function (o) { o.classList.toggle("selected", o === opt); });
      textEl.textContent = prefix + opt.textContent;
      el.classList.remove("open");
      if (fire) onChange(opt.getAttribute("data-val"));
    }

    function toggleMulti(opt, fire) {
      if (opt === allOpt) opts.forEach(function (o) { o.classList.remove("selected"); });
      else opt.classList.toggle("selected");
      syncLabel();
      if (fire) onChange(chosen());          // menu deliberately stays open
    }

    opts.forEach(function (o) {
      o.addEventListener("click", function () {
        if (multi) toggleMulti(o, true); else selectSingle(o, true);
      });
    });
    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      $all(".dd.open").forEach(function (d) { if (d !== el) d.classList.remove("open"); });
      el.classList.toggle("open");
    });
    document.addEventListener("click", function () { el.classList.remove("open"); });
    menu.addEventListener("click", function (e) { e.stopPropagation(); });

    /* The chip row needs to deselect an option it did not click, so expose a
       setter rather than duplicating the DOM bookkeeping out there. */
    if (multi) el.ddSet = function (vals) {
      opts.forEach(function (o) {
        if (o !== allOpt) o.classList.toggle("selected", vals.indexOf(o.getAttribute("data-val")) !== -1);
      });
      syncLabel();
    };

    // preselect the default
    if (multi) { syncLabel(); return; }
    var def = el.getAttribute("data-default");
    var match = opts.filter(function (o) { return o.getAttribute("data-val") === def; })[0] || opts[0];
    if (match) selectSingle(match, false);
  }

  /* ----------------------------- views + nav -----------------------------
     Two views on one document, addressed by hash so a reload, a bookmark and
     the back button all land where the operator expects. The hash is the single
     source of truth: nav clicks only set it, and applyView() runs off the
     hashchange that follows. */
  function viewFromHash() {
    return (location.hash || "").replace(/^#\/?/, "") === "high-intent" ? "high" : "feed";
  }

  function applyView(v, reload) {
    feedState.view = VIEWS[v] ? v : "feed";
    $all(".nav-item[data-view]").forEach(function (b) {
      var on = b.getAttribute("data-view") === feedState.view;
      b.classList.toggle("active", on);
      if (on) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current");
    });
    var title = $(".topbar__title");
    if (title) title.textContent = VIEWS[feedState.view].title;
    document.title = VIEWS[feedState.view].title + " — Wandar";

    // The Intent pill is meaningless on High Intent — hide it rather than let it
    // offer a filter that contradicts the view.
    var ddIntent = $("#dd-intent");
    if (ddIntent) ddIntent.hidden = feedState.view === "high";

    // High Intent is a working list, not a dashboard: no KPI cards, score-band
    // tabs instead. Reset the band so the view never opens pre-filtered.
    var high = feedState.view === "high";
    var counters = $("#counters"); if (counters) counters.hidden = high;
    var tabs = $("#band-tabs"); if (tabs) tabs.hidden = !high;
    if (!high) feedState.band = "all";
    if (high) setBand("all", false);

    if (reload) { page = 1; loadCounters(); loadBandCounts(); loadFeed(); }
  }

  function renderDestChips() {
    var wrap = $("#dest-chips");
    if (!wrap) return;
    var d = feedState.destinations;
    wrap.hidden = !d.length;
    if (!d.length) { wrap.innerHTML = ""; return; }
    // "Showing: Tanzania × · Botswana × · Namibia ×   Clear all"
    wrap.innerHTML = '<span>Showing:</span>' + d.map(function (name, i) {
      return (i ? '<span class="chip__sep">·</span>' : "") +
             '<span class="chip">' + esc(name) +
             '<button class="chip__x" type="button" data-remove="' + esc(name) +
             '" aria-label="Remove ' + esc(name) + '">&times;</button></span>';
    }).join("") + (d.length > 1 ? '<button class="chips__clear" type="button" id="chips-clear">Clear all</button>' : "");
  }

  function setDestinations(list) {
    feedState.destinations = list;
    var dd = $("#dd-destination");
    if (dd && dd.ddSet) dd.ddSet(list);      // keep the menu ticks in step
    renderDestChips();
    applySearch();
  }

  function setBand(b, reload) {
    feedState.band = BANDS[b] ? b : "all";
    $all(".tab[data-band]").forEach(function (t) {
      t.classList.toggle("is-active", t.getAttribute("data-band") === feedState.band);
    });
    if (reload) { page = 1; loadFeed(); }
  }

  /* Tab counts are whole-band totals: like the KPI cards they ignore the pills,
     so a tab never claims a number the other filters would shrink. */
  function loadBandCounts() {
    if (DEMO || feedState.view !== "high") return;
    Object.keys(BANDS).forEach(function (key) {
      var el = $("[data-band-count='" + key + "']");
      if (!el) return;
      var b = BANDS[key];
      var q = notExpired(sb.from("leads").select("*", { count: "exact", head: true })).eq("tier", "High Intent");
      if (b.min !== null) q = q.gte("score", b.min);
      if (b.max !== null) q = q.lt("score", b.max);
      q.then(function (r) { el.textContent = "(" + (r.count || 0) + ")"; });
    });
  }

  function initTabs() {
    $all(".tab[data-band]").forEach(function (t) {
      t.addEventListener("click", function () { setBand(t.getAttribute("data-band"), true); });
    });
  }

  function initNav() {
    $all(".nav-item[data-view]").forEach(function (b) {
      b.addEventListener("click", function () {
        var v = b.getAttribute("data-view");
        var want = v === "high" ? "#/high-intent" : "";
        // Setting an identical hash fires no hashchange, so re-apply directly.
        if ((location.hash || "") === want) {
          applyView(v, true);                    // identical hash fires no event
        } else if (want) {
          location.hash = want;                  // hashchange does the rest
        } else {
          // Clearing the hash: replaceState leaves no empty "#" in the URL, but
          // it also fires no hashchange, so apply the view by hand.
          history.replaceState(null, "", location.pathname + location.search);
          applyView("feed", true);
        }
      });
    });
    window.addEventListener("hashchange", function () { applyView(viewFromHash(), true); });

    var nav = $("#sidenav"), toggle = $("#nav-toggle");
    if (nav && toggle) {
      var collapsed = false;
      try { collapsed = localStorage.getItem(NAV_KEY) === "1"; } catch (e) {}
      function setCollapsed(c) {
        nav.classList.toggle("sidebar--collapsed", c);
        toggle.setAttribute("aria-expanded", c ? "false" : "true");
        toggle.title = c ? "Expand menu" : "Collapse menu";
        try { localStorage.setItem(NAV_KEY, c ? "1" : "0"); } catch (e) {}
      }
      setCollapsed(collapsed);
      toggle.addEventListener("click", function () {
        setCollapsed(!nav.classList.contains("sidebar--collapsed"));
      });
    }
  }

  /* ----------------------------- page: feed ----------------------------- */
  function initFeedPage() {
    initModals();
    initNav();
    initTabs();
    applyView(viewFromHash(), false);      // before the first load, so it queries the right view
    getSession(function (session) {
      if (!session) { location.href = (CFG.AUTH_URL || "auth.html") + "?mode=signin"; return; }
      getUser(function (user) { initProfileMenu(user); loadCounters(); loadBandCounts(); loadFeed(); });
    });

    initDropdown($("#dd-source"), function (v) { feedState.source = v; loadFeed(); });
    initDropdown($("#dd-intent"), function (v) { feedState.intent = v; loadFeed(); });
    var ddDest = $("#dd-destination");
    if (ddDest) ddDest.hidden = false;
    // applySearch, not loadFeed: the filter runs over rows already fetched, so
    // switching destination costs no round trip (same as the text search).
    initDropdown(ddDest, function (v) { setDestinations(v); });

    var chips = $("#dest-chips");
    if (chips) chips.addEventListener("click", function (e) {
      var x = e.target.closest ? e.target.closest("[data-remove]") : null;
      if (x) {
        var name = x.getAttribute("data-remove");
        setDestinations(feedState.destinations.filter(function (n) { return n !== name; }));
        return;
      }
      if (e.target.id === "chips-clear") setDestinations([]);
    });
    initDropdown($("#dd-daterange"), function (v) { feedState.dateRange = v; loadFeed(); });

    var searchEl = $("#feed-search"), searchClear = $("#feed-search-clear");
    if (searchEl) {
      searchEl.addEventListener("input", function () {
        feedState.q = searchEl.value.trim().toLowerCase();
        if (searchClear) searchClear.hidden = !searchEl.value;
        applySearch();
      });
      // Enter would submit and reload the page; the filtering is already live.
      searchEl.addEventListener("keydown", function (e) { if (e.key === "Enter") e.preventDefault(); });
      if (searchClear) searchClear.addEventListener("click", function () {
        searchEl.value = ""; feedState.q = ""; searchClear.hidden = true;
        applySearch(); searchEl.focus();
      });
    }

    // row interactions: thumbs vote · view link · else open the side panel
    var feedBody = $("#feed-body");
    if (feedBody) feedBody.addEventListener("click", function (e) {
      var fb = e.target.closest ? e.target.closest(".fb") : null;
      if (fb) { e.stopPropagation(); castVote(fb.closest(".feed__fb").getAttribute("data-key"), fb.getAttribute("data-vote")); return; }
      if (e.target.closest(".feed__reply")) return;  // let the link open in a new tab
      var tr = e.target.closest("tr[data-idx]");
      if (tr) openPanel(allRows[parseInt(tr.getAttribute("data-idx"), 10)]);
    });

    // pagination
    var prev = $("#pager-prev"), next = $("#pager-next"), top = $("#pager-top");
    if (prev) prev.addEventListener("click", function () { if (page > 1) goPage(page - 1); });
    if (next) next.addEventListener("click", function () { goPage(page + 1); });
    if (top) top.addEventListener("click", scrollToTop);

    // side panel: thumbs + close handlers
    var lpFb = $("#lp-fb");
    if (lpFb) {
      $(".fb.up", lpFb).innerHTML = THUMB_UP;
      $(".fb.down", lpFb).innerHTML = THUMB_DOWN;
      lpFb.addEventListener("click", function (e) {
        var fb = e.target.closest(".fb"); if (!fb) return;
        castVote(lpFb.getAttribute("data-key"), fb.getAttribute("data-vote"));
      });
    }
    var lpClose = $("#lp-close"), lpOverlay = $("#lead-panel");
    if (lpClose) lpClose.addEventListener("click", closePanel);
    if (lpOverlay) lpOverlay.addEventListener("click", function (e) { if (e.target === lpOverlay) closePanel(); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") closePanel(); });

    // sort by Date Posted (toggle desc/asc) — the only sort control
    initDropdown($("#dd-sort"), function (v) { setSort(v); });

    var so = $("#sign-out"); if (so) so.addEventListener("click", signOut);
  }

  /* ----------------------------- boot ----------------------------- */
  document.addEventListener("DOMContentLoaded", function () {
    var page = document.body.getAttribute("data-page");
    if (page === "auth") initAuthPage();
    else if (page === "feed") initFeedPage();
  });

  window.WandarLiveCounts = loadCounters;   // for the landing embed
})();
