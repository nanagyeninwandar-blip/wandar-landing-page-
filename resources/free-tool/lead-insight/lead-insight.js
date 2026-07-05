/* Lead Insight Generator, view state machine + rendering.
 *
 * Flow: input → loading (staged) → result.
 * The serverless function only classifies; the score is computed here by
 * the deterministic scoring.js so results are reproducible and testable.
 * All dynamic text is inserted via textContent, never innerHTML, so the
 * pasted enquiry and extracted values can't inject markup.
 */

import { score, ALL_SIGNALS } from "./scoring.js";
import {
  buildResultCopy,
  LOADING_STAGES,
  WORLDVIEW_TIPS,
  SIGNAL_LABELS,
  STATE_LABELS,
  SOURCE_LABELS,
} from "./copy.js";

const MAX_CHARS = 5000;
const STAGE_MS = 7500; // per stage: a generous beat to read each worldview line
const MIN_LOADING_MS = 30000; // 4 stages x 7.5s: results reveal after ~30s of pacing

const $ = (id) => document.getElementById(id);

const views = {
  input: $("li-view-input"),
  result: $("li-view-result"),
};
const loading = $("li-loading");

const ta = $("li-enquiry");
const counter = $("li-count");
const submitBtn = $("li-submit");
const errorBox = $("li-error");
const errorText = $("li-error-text");
const emailInput = $("li-email-input");

const EMAIL_RE = /\S+@\S+\.\S+/; // same rule as the site's modal forms
const EMAIL_STORE_KEY = "wandar-li-email";

let selectedSource = null;
let stageTimer = null;

/* ---------- input view ---------- */

function emailValid() {
  return EMAIL_RE.test(emailInput.value.trim());
}

function refreshInput() {
  counter.textContent = `${ta.value.length} / ${MAX_CHARS}`;
  submitBtn.disabled = ta.value.trim().length === 0 || !emailValid();
  emailInput.classList.toggle(
    "li-email__input--invalid",
    emailInput.value.trim().length > 0 && !emailValid()
  );
}
ta.addEventListener("input", refreshInput);
emailInput.addEventListener("input", refreshInput);

// Returning operators shouldn't retype their email.
try {
  const saved = localStorage.getItem(EMAIL_STORE_KEY);
  if (saved) emailInput.value = saved;
} catch { /* storage unavailable, fine */ }

document.querySelectorAll(".li-chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    const isActive = chip.classList.contains("li-chip--active");
    document.querySelectorAll(".li-chip").forEach((c) => c.classList.remove("li-chip--active"));
    if (!isActive) {
      chip.classList.add("li-chip--active");
      selectedSource = chip.dataset.source;
    } else {
      selectedSource = null;
    }
  });
});

function showError(code) {
  const messages = {
    rate_limited: "Too many requests at once. Give it a minute and try again.",
    enquiry_too_long: `That enquiry is over ${MAX_CHARS.toLocaleString()} characters. Trim it to the traveler's message and try again.`,
    not_configured: "The analysis service isn't configured yet (missing API key on the server). Your text is untouched.",
    offline: "We couldn't reach the analysis service. Check your connection and try again.",
    default: "Something went wrong while analyzing the enquiry. Your text is untouched. Please try again.",
  };
  errorText.textContent = messages[code] || messages.default;
  errorBox.classList.add("li-error--show");
}

/* ---------- loading view ---------- */

let runTips = WORLDVIEW_TIPS.slice(0, LOADING_STAGES.length);

const TIP_DECK_KEY = "wandar-li-tip-deck";

function shuffledIndices() {
  const idx = WORLDVIEW_TIPS.map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  return idx;
}

/* Deck sampling: the full pool is shuffled once and dealt 4 tips per run,
 * so no run repeats a tip until every line has been shown, then reshuffles.
 * The deck persists across visits via localStorage. */
function drawTips() {
  let deck = [];
  try {
    deck = JSON.parse(localStorage.getItem(TIP_DECK_KEY)) || [];
  } catch { /* fresh deck below */ }
  deck = Array.isArray(deck)
    ? deck.filter((i) => Number.isInteger(i) && i >= 0 && i < WORLDVIEW_TIPS.length)
    : [];
  if (deck.length < LOADING_STAGES.length) deck = shuffledIndices();
  const hand = deck.splice(0, LOADING_STAGES.length);
  try {
    localStorage.setItem(TIP_DECK_KEY, JSON.stringify(deck));
  } catch { /* storage unavailable, random-only is fine */ }
  return hand.map((i) => WORLDVIEW_TIPS[i]);
}

function setStage(index) {
  const steps = document.querySelectorAll(".li-step");
  steps.forEach((step, i) => {
    step.classList.toggle("li-step--done", i < index);
    step.classList.toggle("li-step--active", i === index);
  });
  $("li-tip-text").textContent = runTips[index];
  $("li-rail-fill").style.width = `${(index / (LOADING_STAGES.length - 1)) * 100}%`;
}

function startLoading() {
  runTips = drawTips(); // dealt from the persistent deck: no repeats across runs
  loading.classList.add("li-loading--active");
  document.body.style.overflow = "hidden";
  let stage = 0;
  setStage(0);
  stageTimer = setInterval(() => {
    // Hold on the final stage until the response lands.
    if (stage < LOADING_STAGES.length - 1) setStage(++stage);
  }, STAGE_MS);
}

function stopLoading() {
  clearInterval(stageTimer);
  stageTimer = null;
  loading.classList.remove("li-loading--active");
  document.body.style.overflow = "";
}

/* ---------- submit ---------- */

/** Lead capture via Netlify Forms, fire-and-forget, never blocks the analysis. */
function captureLead(email) {
  try {
    localStorage.setItem(EMAIL_STORE_KEY, email);
  } catch { /* storage unavailable, fine */ }
  const body = new URLSearchParams({
    "form-name": "lead-insight-tool",
    "bot-field": "",
    email,
    source: selectedSource || "",
  });
  fetch("/", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  }).catch(() => { /* capture is best-effort */ });
}

async function generate() {
  const enquiry = ta.value.trim();
  const email = emailInput.value.trim();
  if (!enquiry || !EMAIL_RE.test(email)) return;
  errorBox.classList.remove("li-error--show");

  captureLead(email);

  const startedAt = Date.now();
  startLoading();

  let classification;
  try {
    const res = await fetch("/api/classify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ enquiry }),
    });
    if (!res.ok) {
      let code = "default";
      try {
        code = (await res.json()).error || "default";
      } catch { /* keep default */ }
      throw new Error(code);
    }
    classification = await res.json();
    validateClassification(classification);
  } catch (err) {
    stopLoading();
    showError(err instanceof TypeError ? "offline" : err.message);
    return;
  }

  const scored = score(classification.signals);
  renderResult(classification, scored);

  // Let the final stage breathe so the tips are readable.
  const remaining = Math.max(0, MIN_LOADING_MS - (Date.now() - startedAt));
  setTimeout(() => {
    setStage(LOADING_STAGES.length - 1);
    setTimeout(() => {
      stopLoading();
      views.input.classList.remove("li-view--active");
      views.result.classList.add("li-view--active");
      document.querySelector(".li-reset-top")?.classList.add("li-reset-top--show");
      window.scrollTo({ top: 0, behavior: "instant" });
    }, Math.min(600, remaining + 400));
  }, remaining);
}

function validateClassification(data) {
  if (!data || typeof data !== "object" || !data.signals) throw new Error("default");
  for (const key of ALL_SIGNALS) {
    const entry = data.signals[key];
    if (!entry || typeof entry.state !== "string") throw new Error("default");
  }
  if (!Array.isArray(data.notable_details)) data.notable_details = [];
}

submitBtn.addEventListener("click", generate);

/* ---------- result rendering ---------- */

const ICONS = {
  destination: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>',
  travel_dates: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>',
  budget: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v12M15.5 9.2c-.6-1-1.9-1.6-3.5-1.6-2 0-3.5 1-3.5 2.4 0 3.4 7 1.8 7 5 0 1.4-1.5 2.4-3.5 2.4-1.6 0-2.9-.6-3.5-1.6"/></svg>',
  group_size: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  urgency: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 7v5l3 2"/></svg>',
  star: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
  source: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 7l10 7 10-7"/></svg>',
};

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function iconSpan(svg) {
  const span = document.createElement("span");
  span.innerHTML = svg; // static markup from ICONS only, never user data
  return span.firstElementChild;
}

function renderResult(classification, scored) {
  const copy = buildResultCopy(classification.signals, scored);
  const result = $("li-view-result");
  result.className = `li-view li-result li-result--${scored.tier}`;

  // Gauge, arc proportional to score/10 (Very Low renders its 3.0).
  const arc = $("li-gauge-arc");
  const radius = 84;
  const circumference = 2 * Math.PI * radius;
  arc.setAttribute("stroke-dasharray", circumference.toFixed(1));
  arc.setAttribute("stroke-dashoffset", (circumference * (1 - scored.score / 10)).toFixed(1));
  $("li-gauge-score").textContent = scored.score.toFixed(1);
  $("li-pill").textContent = copy.intentLabel;
  $("li-decision").textContent = `Decision: ${copy.decision}`;
  $("li-star").textContent = copy.star;

  // Intent breakdown.
  const breakdown = $("li-breakdown");
  breakdown.replaceChildren();
  for (const key of ALL_SIGNALS) {
    const state = classification.signals[key].state;
    const row = el("div", "li-break__row");
    const sig = el("span", "li-break__sig");
    sig.appendChild(iconSpan(ICONS[key]));
    sig.appendChild(document.createTextNode(SIGNAL_LABELS[key]));
    const stateEl = el("span", `li-break__state li-state--${state}`);
    stateEl.appendChild(el("span", "li-break__dot"));
    stateEl.appendChild(document.createTextNode(STATE_LABELS[state]));
    row.append(sig, stateEl);
    breakdown.appendChild(row);
  }

  // Headline block.
  $("li-headline").textContent = copy.headline;
  $("li-subline").textContent = copy.subline;

  // Next-step checklist.
  const check = $("li-checklist");
  check.replaceChildren();
  copy.checklist.forEach((item, i) => {
    const row = el("div", "li-check__item");
    const box = document.createElement("input");
    box.type = "checkbox";
    box.className = "li-check__box";
    box.id = `li-check-${i}`;
    box.addEventListener("change", () => row.classList.toggle("li-check__item--done", box.checked));
    const label = document.createElement("label");
    label.htmlFor = box.id;
    label.textContent = item;
    row.append(box, label);
    check.appendChild(row);
  });

  // Ready-to-send questions.
  const qWrap = $("li-questions");
  const qList = $("li-questions-list");
  qList.replaceChildren();
  if (copy.questions.length > 0) {
    qWrap.style.display = "";
    copy.questions.forEach((q) => qList.appendChild(el("div", "li-q", q)));
  } else {
    qWrap.style.display = "none";
  }

  // Enquiry summary.
  const summary = $("li-summary");
  summary.replaceChildren();
  let summarized = 0;
  for (const key of ALL_SIGNALS) {
    const entry = classification.signals[key];
    const counting = entry.state === "specific" || entry.state === "very_specific";
    if (counting && entry.value) {
      const row = el("div", "li-sum__row");
      row.appendChild(iconSpan(ICONS[key]));
      row.appendChild(document.createTextNode(entry.value));
      summary.appendChild(row);
      summarized++;
    }
  }
  for (const detail of classification.notable_details.slice(0, 4)) {
    const row = el("div", "li-sum__row li-sum__row--extra");
    row.appendChild(iconSpan(ICONS.star));
    row.appendChild(document.createTextNode(detail));
    summary.appendChild(row);
    summarized++;
  }
  if (selectedSource && SOURCE_LABELS[selectedSource]) {
    const row = el("div", "li-sum__row");
    row.appendChild(iconSpan(ICONS.source));
    row.appendChild(document.createTextNode(`Came in via ${SOURCE_LABELS[selectedSource]}`));
    summary.appendChild(row);
    summarized++;
  }
  if (summarized === 0) {
    summary.appendChild(el("div", "li-miss__none", "Nothing concrete to summarize yet. The enquiry stays vague on every signal."));
  }

  // Missing information.
  const missing = $("li-missing");
  missing.replaceChildren();
  if (copy.gaps.length === 0) {
    missing.appendChild(el("div", "li-miss__none", "Nothing critical is missing. You have what you need to quote with confidence."));
  } else {
    for (const gap of copy.gaps) {
      const row = el("div", "li-miss__row");
      row.appendChild(el("span", "li-miss__dot"));
      row.appendChild(document.createTextNode(gap.text));
      missing.appendChild(row);
    }
  }

  // Why this matters.
  $("li-why-body").textContent = copy.why;
  $("li-why-callout-text").textContent = copy.callout;

  // Print report header date.
  $("li-print-date").textContent = new Date().toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/* ---------- download as PDF (browser print) ---------- */

$("li-download").addEventListener("click", () => {
  const previousTitle = document.title;
  // The browser uses the title as the default PDF filename.
  document.title = `Wandar Lead Insight ${$("li-gauge-score").textContent} - ${$("li-pill").textContent}`;
  window.print();
  document.title = previousTitle;
});

/* ---------- copy questions ---------- */

$("li-copy-questions").addEventListener("click", async () => {
  const text = [...document.querySelectorAll("#li-questions-list .li-q")]
    .map((q) => q.textContent)
    .join("\n\n");
  const btn = $("li-copy-questions");
  try {
    await navigator.clipboard.writeText(text);
    btn.dataset.label = btn.textContent;
    btn.textContent = "Copied ✓";
    setTimeout(() => { btn.textContent = btn.dataset.label; }, 1800);
  } catch {
    // Clipboard unavailable (permissions), select-and-copy fallback prompt.
    btn.textContent = "Press Ctrl+C";
    window.getSelection().selectAllChildren($("li-questions-list"));
    setTimeout(() => { btn.textContent = "Copy questions"; }, 2500);
  }
});

/* ---------- reset ---------- */

function resetTool() {
  views.result.classList.remove("li-view--active");
  views.input.classList.add("li-view--active");
  document.querySelector(".li-reset-top")?.classList.remove("li-reset-top--show");
  ta.value = "";
  document.querySelectorAll(".li-chip").forEach((c) => c.classList.remove("li-chip--active"));
  selectedSource = null;
  refreshInput();
  window.scrollTo({ top: 0, behavior: "instant" });
  ta.focus();
}
document.querySelectorAll(".js-li-reset").forEach((btn) => btn.addEventListener("click", resetTool));

refreshInput();
