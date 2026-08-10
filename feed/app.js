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
    if (DEMO) {
      // derive from the rows we actually render, so the cards can never claim a
      // total the feed can't show (they used to: 238 hardcoded vs 60 sample rows)
      var L = (SAMPLE.leads || []).filter(notExpiredRow);
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
      return q.then(function (r) { return r.count || 0; });
    }
    Promise.all([count(null), count("reddit"), count("tripadvisor")]).then(function (c) {
      set({ all: c[0], reddit: c[1], tripadvisor: c[2] });
    });
  }

  /* ----------------------------- feed ----------------------------- */
  // Signing in shows every lead matching the current Source + Date range filters,
  // newest first. sortDir is toggled only by the "Date Posted" column header.
  var feedState = { source: "all", sortDir: "desc", dateRange: "all" };

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
    var caret = $("#sort-caret");
    if (caret) caret.textContent = feedState.sortDir === "desc" ? "↓" : "↑";
    loadFeed();
  }

  function demoLeads(source) {
    var cutoff = dateRangeCutoff(feedState.dateRange);
    return SAMPLE.leads.filter(function (l) {
      return (source === "all" || l.source === source) && notExpiredRow(l) &&
        (!cutoff || (l.post_date && l.post_date >= cutoff));
    });
  }
  function liveLeads(source) {
    var cutoff = dateRangeCutoff(feedState.dateRange);
    // travel_window_end isn't a real column yet either (see the notExpired comment
    // above) — selecting a nonexistent column 400s independently of the WHERE filter.
    var cols = "id,source,title,body,url,post_date" + (TRAVEL_EXPIRY_LIVE ? ",travel_window_end" : "");
    var q0 = sb.from("leads").select(cols)
      .order("post_date", { ascending: feedState.sortDir === "asc" }).limit(500);
    if (cutoff) q0 = q0.gte("post_date", cutoff);
    var q = notExpired(q0);
    if (source !== "all") q = q.eq("source", source);
    return q.then(function (r) { return r.data || []; });
  }

  var PAGE_SIZE = 25;
  var allRows = [];   // full filtered + sorted set
  var page = 1;

  function loadFeed() {
    var body = $("#feed-body");
    if (!body) return;
    if (DEMO) { setRows(sortRows(demoLeads(feedState.source))); return; }
    body.innerHTML = '<tr><td colspan="2" class="feed-empty">Loading opportunities…</td></tr>';
    liveLeads(feedState.source).then(function (rows) { setRows(sortRows(rows)); }).catch(function (e) {
      body.innerHTML = '<tr><td colspan="2" class="feed-empty">Could not load leads. ' + esc(e.message || "") + '</td></tr>';
    });
  }

  function setRows(rows) { allRows = rows; page = 1; renderPage(); }

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
      body.innerHTML = '<tr><td colspan="2" class="feed-empty">No leads match these filters. Try a wider <b>Date range</b> or <b>All Sources</b>.</td></tr>';
      return;
    }
    var votes = getVotes();
    body.innerHTML = rows.map(function (r, i) {
      var src = (r.source === "reddit") ? "reddit" : "tripadvisor";
      var key = r.url, v = votes[key];
      // title and body are separate blocks so each clamps on its own
      // (1 line for the title, 3 for the body) — see .ft-title / .ft-body
      var bodyHtml = r.body ? '<div class="ft-body">' + esc(r.body) + '</div>' : "";
      return '' +
        '<tr data-idx="' + (offset + i) + '">' +
          '<td><div class="feed__post">' +
            '<span class="src-badge ' + src + '">' + GLYPH[src] + '</span>' +
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
        function bad(el, is) { var w = el && el.closest(".authfield"); if (w) w.classList.toggle("invalid", !!is); return is; }

        var missing = false;
        if (!EMAIL_RE.test(email)) { bad(emailEl, true); missing = true; } else bad(emailEl, false);
        if (!companyEl.value.trim()) { bad(companyEl, true); missing = true; } else bad(companyEl, false);
        if (!roleEl.value) { bad(roleEl, true); missing = true; } else bad(roleEl, false);
        if (!goalEl.value) { bad(goalEl, true); missing = true; } else bad(goalEl, false);
        if (missing) { showMsg(msg, "error", "Please fill in the required fields."); return; }

        // collect tools
        var tools = [];
        $all(".ea-check__row input[type=checkbox]", form).forEach(function (chk) {
          if (!chk.checked) return;
          var key = chk.getAttribute("data-nested");
          if (key === "crm") { var v = ($("#ea-crm", form) || {}).value; tools.push("CRM" + (v ? ": " + v : "")); }
          else if (key === "booking") { var b = ($("#ea-booking", form) || {}).value; tools.push("Booking" + (b ? ": " + b : "")); }
          else if (chk.value) tools.push(chk.value);
        });
        var goal = goalEl.value === "other" ? (($("#ea-goal-other input", form) || {}).value || "Something else") : goalEl.value;
        var payload = { email: email, company: companyEl.value.trim(), role: roleEl.value, goal: goal, tools: tools.join(", ") };

        if (DEMO) { showMsg(msg, "ok", "You're on the list — we'll be in touch."); form.reset(); if (goalOther) goalOther.classList.remove("visible"); $all(".ea-nested", form).forEach(function (n) { n.classList.remove("visible"); }); return; }
        getUser(function (u) {
          payload.user_id = u ? u.id : null;
          sb.from("waitlist").insert(payload)
            // "check your inbox" promised mail that is never sent — no welcome
            // email is wired (PENDING.md §2) and this page sends none by design.
            .then(function (r) { if (r.error) showMsg(msg, "error", r.error.message); else { showMsg(msg, "ok", "You're on the list — we'll be in touch."); form.reset(); } });
        });
      });
    }
  }
  function showMsg(el, kind, text) { if (!el) return; el.textContent = text; el.className = "form-msg show " + kind; }

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

    var firstEl = $("#auth-first"), lastEl = $("#auth-last");
    var companyEl = $("#auth-company"), roleEl = $("#auth-role"), newsEl = $("#auth-newsletter");
    var consentWrap = newsEl.closest(".consent");
    var formMsg = $("#auth-msg"), submit = $("#auth-submit");

    // The ONLY source of the email — there is no field for it on this page.
    // `?mode=signin` (the landing nav's old "Log In" target) carries no email, so
    // it falls through the guard below and lands on the hero, which is now the
    // single way in for everyone.
    var heroEmail = (new URLSearchParams(location.search).get("email") || "").trim();

    /* Hold the card back while we work out whether this person is already an
       operator. Without this a returning visitor sees the signup form flash up
       before the redirect fires. Applied from JS, never from the HTML, and with
       a hard timer behind it — if anything below throws or hangs, the form still
       appears rather than leaving a blank page. */
    var card = $(".auth-card");
    var revealTimer = setTimeout(reveal, 4000);
    if (card) card.classList.add("is-checking");
    function reveal() { clearTimeout(revealTimer); if (card) card.classList.remove("is-checking"); }

    /* An existing session always wins. A returning operator on this device goes
       straight to the feed and never sees this page again — they don't retype
       anything, not even their email.

       This MUST resolve before the no-email bounce below. getSession is async;
       when the bounce ran first (synchronously) a signed-in visitor opening a
       bare /auth.html was thrown out to the marketing page instead of their
       feed. Keep the two decisions in this one callback. */
    getSession(function (s) {
      if (s) { location.replace(CFG.FEED_URL || "app.html"); return; }

      // No session and no email means the visitor skipped the hero (bookmark,
      // shared link, back button, or a "Log In" link). Rather than show a form
      // that cannot be submitted, send them to the hero that asks for it.
      if (!EMAIL_RE.test(heroEmail)) { location.replace(CFG.HOME_URL || "index.html"); return; }

      // No session, but this device might still belong to someone who signed up
      // on a different one. Ask the server before making them fill the form.
      heroSignIn(heroEmail, function (ok) {
        if (ok) return;                       // heroSignIn has navigated to the feed
        reveal();
        firstEl.focus();                      // new operator — email came from the hero
      });
    });

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

    [firstEl, lastEl, companyEl, roleEl].forEach(function (el) {
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
      var email = heroEmail;                      // from ?email=, validated on load
      var first = firstEl.value.trim(), last = lastEl.value.trim();
      var company = companyEl.value.trim(), role = roleEl.value;
      var fullName = (first + " " + last).trim();

      // The button is disabled until this is ticked; this is the belt to that braces.
      if (!newsEl.checked) { consentWrap.classList.add("invalid"); return; }

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
  function initDropdown(el, onChange) {
    if (!el) return;
    var btn = $(".dd__btn", el), textEl = $(".dd__text", el), menu = $(".dd__menu", el);
    var prefix = el.getAttribute("data-prefix") || "";
    var opts = $all(".dd__opt", el);
    function select(opt, fire) {
      opts.forEach(function (o) { o.classList.toggle("selected", o === opt); });
      textEl.textContent = prefix + opt.textContent;
      el.classList.remove("open");
      if (fire) onChange(opt.getAttribute("data-val"));
    }
    opts.forEach(function (o) { o.addEventListener("click", function () { select(o, true); }); });
    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      $all(".dd.open").forEach(function (d) { if (d !== el) d.classList.remove("open"); });
      el.classList.toggle("open");
    });
    document.addEventListener("click", function () { el.classList.remove("open"); });
    menu.addEventListener("click", function (e) { e.stopPropagation(); });
    // preselect the default
    var def = el.getAttribute("data-default");
    var match = opts.filter(function (o) { return o.getAttribute("data-val") === def; })[0] || opts[0];
    if (match) select(match, false);
  }

  /* ----------------------------- page: feed ----------------------------- */
  function initFeedPage() {
    initModals();
    getSession(function (session) {
      if (!session) { location.href = (CFG.AUTH_URL || "auth.html") + "?mode=signin"; return; }
      getUser(function (user) { initProfileMenu(user); loadCounters(); loadFeed(); });
    });

    initDropdown($("#dd-source"), function (v) { feedState.source = v; loadFeed(); });
    initDropdown($("#dd-daterange"), function (v) { feedState.dateRange = v; loadFeed(); });

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
    var sortH = $("#sort-date");
    if (sortH) sortH.addEventListener("click", function () {
      setSort(feedState.sortDir === "desc" ? "asc" : "desc");
    });

    // Pricing → landing pricing page in a new tab
    var priceLink = $("#pricing-link");
    if (priceLink) priceLink.addEventListener("click", function () {
      window.open(CFG.PRICING_URL || "https://www.getwandar.com/pricing.html", "_blank", "noopener");
    });

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
