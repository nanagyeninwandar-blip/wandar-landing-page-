// PostHog analytics — loaded (defer) on index.html and feed/app.html.
//
// Events (object_action): cta_clicked, form_opened, form_submitted,
// form_abandoned, form_submit_failed, section_viewed, faq_opened,
// outbound_link_clicked. Names, emails, phones and company names never go
// into event properties — only into identify() / person properties.
//
// ?internal=1 marks this browser as ours: PostHog is never loaded here again.
// ?internal=0 undoes it. ?ph_debug=1 logs every event to the console.

(function () {
  // Project API key (phc_…). Public by design — it can only send events.
  // Leave empty to turn analytics off.
  var POSTHOG_KEY  = 'phc_pqwKMpxtN7GBARnT9DC78x7WR4q8WH6xE6p8xQKjuwzJ';
  var POSTHOG_HOST = 'https://us.i.posthog.com';   // EU: https://eu.i.posthog.com
  var POSTHOG_UI   = 'https://us.posthog.com';     // EU: https://eu.posthog.com

  var qs = new URLSearchParams(location.search);

  // ── INTERNAL TRAFFIC ──────────────────────────────────────────────
  // Not opt_out_capturing(): with cookieless_mode 'on_reject' an opted-out
  // browser is still counted cookielessly. Never loading PostHog is the only
  // way to keep our own visits out.
  function store(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) {} }
  function read(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  if (qs.get('internal') === '1') store('wandar_internal', '1');
  if (qs.get('internal') === '0') store('wandar_internal', null);
  var internal = read('wandar_internal') === '1';

  var ready = false;   // PostHog loaded and the visitor has answered the banner
  var api = { submitted: noop, failed: noop };
  window.wandarAnalytics = api;
  function noop() {}

  if (!POSTHOG_KEY || internal) return;

  // ── POSTHOG SNIPPET (posthog.com/docs/libraries/js) ───────────────
  !function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.crossOrigin="anonymous",p.async=!0,p.src=s.api_host.replace(".i.posthog.com","-assets.i.posthog.com")+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],Object.defineProperty(u,"toString",{configurable:!0,enumerable:!0,writable:!0,value:function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e}}),Object.defineProperty(u.people,"toString",{configurable:!0,enumerable:!0,writable:!0,value:function(){return u.toString(1)+".people (stub)"}}),o="init capture register register_once register_for_session unregister unregister_for_session getFeatureFlag getFeatureFlagResult isFeatureEnabled reloadFeatureFlags updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures on onFeatureFlags onSessionId getSurveys getActiveMatchingSurveys renderSurvey canRenderSurvey getNextSurveyStep identify setPersonProperties group resetGroups setPersonPropertiesForFlags resetPersonPropertiesForFlags setGroupPropertiesForFlags resetGroupPropertiesForFlags reset get_distinct_id getGroups get_session_id get_session_replay_url alias set_config startSessionRecording stopSessionRecording sessionRecordingStarted captureException loadToolbar get_property getSessionProperty createPersonProfile opt_in_capturing opt_out_capturing has_opted_in_capturing has_opted_out_capturing clear_opt_in_out_capturing debug".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);

  // Production goes through the Netlify proxy in _redirects (/ingest), which
  // only exists on Netlify — local servers talk to PostHog directly.
  var local = location.protocol === 'file:' || /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);

  posthog.init(POSTHOG_KEY, {
    api_host: local ? POSTHOG_HOST : '/ingest',
    ui_host: POSTHOG_UI,
    defaults: '2026-05-30',
    cookieless_mode: 'on_reject',
    person_profiles: 'identified_only',
    autocapture: true,
    capture_heatmaps: true,
    session_recording: { maskAllInputs: true },
    debug: qs.get('ph_debug') === '1',
    loaded: function (ph) {
      if (ph.get_explicit_consent_status() === 'pending') showBanner();
      else start();
    }
  });

  // ── CONSENT BANNER ────────────────────────────────────────────────
  // PostHog keeps the answer in localStorage, so it is asked once.
  function showBanner() {
    var css = document.createElement('style');
    css.textContent =
      '.ph-consent{position:fixed;left:16px;bottom:16px;z-index:8000;max-width:340px;' +
      'background:var(--dark-bg,#111816);color:var(--white,#fff);border:1px solid rgba(255,255,255,.12);' +
      'border-radius:16px;padding:16px 18px;box-shadow:0 12px 32px rgba(0,0,0,.28);' +
      "font-family:var(--font-primary,'Plus Jakarta Sans'),system-ui,sans-serif;font-size:13.5px;line-height:1.5}" +
      '.ph-consent p{margin:0 0 12px}' +
      '.ph-consent__btns{display:flex;gap:8px}' +
      '.ph-consent button{font:inherit;font-weight:600;font-size:13px;border-radius:999px;padding:8px 16px;cursor:pointer}' +
      '.ph-consent__yes{background:var(--safari-primary,#1a7373);color:#fff;border:1px solid var(--safari-primary,#1a7373)}' +
      '.ph-consent__yes:hover{filter:brightness(1.1)}' +
      '.ph-consent__no{background:transparent;color:rgba(255,255,255,.8);border:1px solid rgba(255,255,255,.25)}' +
      '.ph-consent__no:hover{color:#fff;border-color:rgba(255,255,255,.5)}' +
      '@media(max-width:560px){.ph-consent{right:16px;max-width:none}}';
    document.head.appendChild(css);

    var el = document.createElement('div');
    el.className = 'ph-consent';
    el.setAttribute('role', 'region');
    el.setAttribute('aria-label', 'Cookie consent');
    el.innerHTML =
      '<p>We use cookies to understand how people use this site.</p>' +
      '<div class="ph-consent__btns">' +
        '<button type="button" class="ph-consent__yes">Accept</button>' +
        '<button type="button" class="ph-consent__no">Decline</button>' +
      '</div>';
    document.body.appendChild(el);

    function answer(yes) {
      if (yes) posthog.opt_in_capturing(); else posthog.opt_out_capturing();
      el.remove();
      start();
    }
    el.querySelector('.ph-consent__yes').onclick = function () { answer(true); };
    el.querySelector('.ph-consent__no').onclick = function () { answer(false); };
  }

  // ── TRACKING HELPERS ──────────────────────────────────────────────
  function track(name, props, opts) {
    if (!ready) return false;
    posthog.capture(name, props || {}, opts);
    return true;
  }
  function consented() { return posthog.get_explicit_consent_status() === 'granted'; }

  // ── FIRST-TOUCH SUPER PROPERTIES ──────────────────────────────────
  // Read once per page load; register_once keeps the very first visit's values
  // for visitors who accepted cookies (cookieless visitors keep them per page).
  var firstTouch = (function () {
    var p = {};
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'].forEach(function (k) {
      p['first_' + k] = qs.get(k) || null;
    });
    p.first_referrer = document.referrer || '$direct';
    p.first_landing_path = location.pathname;
    return p;
  })();

  // ── START (after the visitor answers, or on load if already answered) ──
  function start() {
    if (ready) return;
    ready = true;
    posthog.register_once(firstTouch);
    watchSections();
    watchModals();
  }

  // Where on the page an element sits — used for cta_clicked / form_opened.
  function locationOf(el) {
    if (!el || !el.closest) return 'other';
    if (el.closest('.mobile-panel')) return 'mobile_menu';
    if (el.closest('#nav, .nav, .topbar')) return 'nav';   // .topbar: feed page profile menu
    if (el.closest('.cta-panel')) return 'final_cta';
    if (el.closest('footer')) return 'footer';
    var sec = el.closest('section[id]');
    if (sec) return sec.id === 'top' ? 'hero' : sec.id;
    return 'other';
  }

  // ── CLICKS: CTAs, FAQ, OUTBOUND LINKS ─────────────────────────────
  // Capture phase: the button's own handler opens the modal, and on a real
  // click the modal observer runs right after it — so the trigger has to be
  // known before the click reaches the button.
  var lastTrigger = null;   // the element that opened the next modal
  document.addEventListener('click', function (e) {
    var opener = e.target && e.target.closest && e.target.closest('[onclick*="openModal("], [data-open]');
    if (!opener) return;
    lastTrigger = opener;
    if (/openModal\('interest'\)/.test(opener.getAttribute('onclick') || '')) {
      track('cta_clicked', { location: locationOf(opener) });
    }
  }, true);

  document.addEventListener('click', function (e) {
    var t = e.target;
    if (!t || !t.closest) return;

    // The FAQ handler toggles .is-open on the button's own listener, which
    // runs before this document-level one — so this sees the new state.
    var q = t.closest('.faq__q');
    if (q && q.parentElement.classList.contains('is-open')) {
      var text = q.cloneNode(true);
      var sign = text.querySelector('.faq__sign'); if (sign) sign.remove();
      track('faq_opened', { question: text.textContent.trim() });
    }

    var a = t.closest('a[href]');
    if (a) {
      var dest = destinationOf(a);
      if (dest) track('outbound_link_clicked', { destination: dest, url: a.href });
    }
  });

  function destinationOf(a) {
    var url;
    try { url = new URL(a.getAttribute('href'), location.href); } catch (e) { return null; }
    if (/\/feed\/app\.html$/.test(url.pathname) && url.origin === location.origin && !/\/feed\//.test(location.pathname)) return 'demand_feed';
    if (url.origin === location.origin || !/^https?:$/.test(url.protocol)) return null;
    var h = url.hostname.replace(/^www\./, '');
    if (h === 'chat.whatsapp.com' || h === 'wa.me' || h === 'whatsapp.com') return 'whatsapp';
    if (h === 'linkedin.com') return 'linkedin';
    if (h === 'x.com' || h === 'twitter.com') return 'x';
    if (h === 'instagram.com') return 'instagram';
    return h;
  }

  // ── SECTION VIEWS (once per session, at 50% visible) ──────────────
  // sessionStorage only when cookies were accepted; otherwise per page load.
  function watchSections() {
    if (!('IntersectionObserver' in window)) return;
    var seen = {};
    function wasSeen(id) {
      if (seen[id]) return true;
      if (consented()) { try { return sessionStorage.getItem('ph_sv_' + id) === '1'; } catch (e) {} }
      return false;
    }
    function markSeen(id) {
      seen[id] = true;
      if (consented()) { try { sessionStorage.setItem('ph_sv_' + id, '1'); } catch (e) {} }
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        var id = en.target.id;
        // A section taller than the screen can never be 50% visible, so it
        // also counts once it fills half the screen.
        var half = en.intersectionRatio >= 0.5 || en.intersectionRect.height >= window.innerHeight * 0.5;
        if (!half || wasSeen(id)) return;
        if (track('section_viewed', { section: id })) { markSeen(id); io.unobserve(en.target); }
      });
    }, { threshold: [0.1, 0.2, 0.3, 0.4, 0.5] });
    document.querySelectorAll('section[id]').forEach(function (s) { io.observe(s); });
  }

  // ── MODAL FORMS ───────────────────────────────────────────────────
  var MODAL_FORMS = { 'modal-interest': 'lets_chat', 'modal-contact': 'contact', 'modal-early-access': 'build_with_us' };
  var NETLIFY_FORMS = { 'interest': 'lets_chat', 'contact': 'contact' };
  var openState = {};   // form -> { lastField, submitted }

  // Watch the .open class so every way of opening/closing (button, ✕,
  // backdrop, Escape) is covered on both pages.
  function watchModals() {
    Object.keys(MODAL_FORMS).forEach(function (id) {
      var ov = document.getElementById(id);
      if (!ov) return;
      var form = MODAL_FORMS[id];
      var wasOpen = ov.classList.contains('open');
      new MutationObserver(function () {
        var isOpen = ov.classList.contains('open');
        if (isOpen === wasOpen) return;
        wasOpen = isOpen;
        if (isOpen) {
          openState[form] = { lastField: null, submitted: false };
          track('form_opened', { form: form, location: locationOf(lastTrigger) });
          lastTrigger = null;
        } else {
          abandon(form);
        }
      }).observe(ov, { attributes: true, attributeFilter: ['class'] });

      ov.addEventListener('focusin', function (e) {
        var f = e.target;
        if (!openState[form] || !/^(INPUT|SELECT|TEXTAREA)$/.test(f.tagName) || f.name === 'bot-field') return;
        openState[form].lastField = f.name || f.id || null;
      });
    });

    // Leaving the page with a modal still open is an abandon too.
    window.addEventListener('pagehide', function () {
      Object.keys(openState).forEach(function (form) { abandon(form, { transport: 'sendBeacon' }); });
    });

    wrapLandingSubmits();
    watchNewsletter();
  }

  function abandon(form, opts) {
    var s = openState[form];
    delete openState[form];
    if (!s || s.submitted) return;
    track('form_abandoned', { form: form, last_field_touched: s.lastField }, opts);
  }

  // Success: form_submitted (+ identify for lead forms). Answers are select
  // values only — never names, emails, phones or company names.
  function submitted(form, answers, person) {
    if (openState[form]) openState[form].submitted = true;
    var props = { form: form };
    for (var k in answers) props[k] = answers[k];
    track('form_submitted', props);
    // The docs advise against identify() for cookieless (declined) visitors.
    if (person && person.email && ready && consented()) {
      posthog.identify(person.email.trim().toLowerCase(), {
        company: person.company || null,
        role: person.role || null,
        org_type: person.org_type || null
      });
    }
  }
  function failed(form, error, extra) {
    var props = { form: form, error: error };
    for (var k in extra) props[k] = extra[k];
    track('form_submit_failed', props);
  }
  api.submitted = submitted;
  api.failed = failed;

  // Landing page modals (assets/js/modals.js): observe netlifySubmit() for the
  // result, and the submit buttons for client-side validation failures.
  function wrapLandingSubmits() {
    if (typeof window.netlifySubmit !== 'function') return;
    var orig = window.netlifySubmit;
    var sent = false;
    window.netlifySubmit = function (formName, data) {
      sent = true;
      var p = orig.apply(this, arguments);
      var form = NETLIFY_FORMS[formName];
      if (!form) return p;
      p.then(function (res) {
        if (res.ok) {
          var answers = form === 'lets_chat' ? {
            job_title: data['job-title'] || null,
            org_type: data['org-type'] || null,
            team_size: data['team-size'] || null,
            beta_tester: data['beta-tester'] || null
          } : {};
          submitted(form, answers, {
            email: data.email,
            company: data.company,
            role: data['job-title'],
            org_type: data['org-type']
          });
        } else {
          failed(form, 'http_' + res.status);
        }
      }, function () { failed(form, 'network'); });
      return p;
    };

    [['mSubmitI', 'lets_chat', 'i'], ['mSubmitC', 'contact', 'c']].forEach(function (w) {
      var fn = window[w[0]];
      if (typeof fn !== 'function') return;
      window[w[0]] = function () {
        sent = false;
        var r = fn.apply(this, arguments);
        if (!sent) {
          var fields = [];
          document.querySelectorAll('[id^="merr-' + w[2] + '-"]').forEach(function (el) {
            if (el.textContent.trim()) fields.push(el.id.slice(7));
          });
          if (fields.length) failed(w[1], 'validation', { fields: fields });
        }
        return r;
      };
    });
  }

  // Footer newsletter: no modal, so "opened" is the first focus on the field.
  // The form has no backend yet; the submit event only fires once the
  // browser's own required/email checks pass.
  function watchNewsletter() {
    var input = document.getElementById('nl-email');
    var form = input && input.form;
    if (!form) return;
    input.addEventListener('focus', function () { track('form_opened', { form: 'newsletter', location: 'footer' }); }, { once: true });
    form.addEventListener('submit', function () { track('form_submitted', { form: 'newsletter' }); });
  }
})();
