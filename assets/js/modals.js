// Shared modal JS — used by index.html and all guide/blog pages

// ── NETLIFY FORM SUBMIT ───────────────────────────────────────────
var _mfDivIds = { 'early-access': 'mf-form-a', 'consultation': 'mf-form-b', 'contact': 'mf-form-c' };
function netlifySubmit(formName, data) {
  var divId = _mfDivIds[formName];
  var botEl = divId ? document.querySelector('#' + divId + ' [name="bot-field"]') : null;
  const body = new URLSearchParams({
    'form-name': formName,
    'bot-field': botEl ? botEl.value : '',
    ...data
  });
  return fetch('/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString()
  });
}

// ── MODALS ────────────────────────────────────────────────────────
function openModal(id) {
  const overlay = document.getElementById('modal-' + id);
  if (!overlay) return;
  document.body.style.overflow = 'hidden';
  overlay.classList.add('open');
  overlay.onclick = function(e) { if (e.target === overlay) closeModal(id); };
}
function closeModal(id) {
  const overlay = document.getElementById('modal-' + id);
  if (!overlay) return;
  overlay.classList.remove('open');
  document.body.style.overflow = '';
}

// Close modals on Escape
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    closeModal('early-access');
    closeModal('consultation');
    closeModal('contact');
  }
});

// ── MODAL FORM HELPERS ────────────────────────────────────────────
function mg(id) { return document.getElementById(id); }
function mToggleNested(prefix, key) {
  const chk  = mg('ma-chk-' + key);
  const nest = mg('ma-nest-' + key);
  if (nest && chk) nest.classList.toggle('visible', chk.checked);
}
function mHandleOther(selId, otherId) {
  const el = mg(otherId);
  if (el) el.classList.toggle('visible', mg(selId).value === 'other');
}
function mHandleGoal(selId, revealId) {
  const el = mg(revealId);
  if (el) el.classList.toggle('visible', mg(selId).value === 'other');
}
function mHandleBGoal() {
  const val = mg('mb-goal').value;
  mg('mb-goal-other').classList.toggle('visible', val === 'other');
  mg('mb-more-wrap').style.display = val ? 'block' : 'none';
}
function mSetErr(id, msg) {
  const el = mg('merr-' + id);
  if (el) el.textContent = msg;
  return !msg;
}
function mValidEmail(v) { return /\S+@\S+\.\S+/.test(v); }

// ── SUBMIT HELPERS ────────────────────────────────────────────────
function mBtnLoading(btn) {
  btn.disabled = true;
  btn._origHTML = btn.innerHTML;
  btn.innerHTML = 'Submitting…';
}
function mBtnReset(btn) {
  btn.disabled = false;
  btn.innerHTML = btn._origHTML;
}

// ── MODAL FORM SUBMISSIONS ────────────────────────────────────────
function mSubmitA() {
  let ok = true;
  ok = mSetErr('a-email',   !mValidEmail(mg('ma-email').value.trim())   ? 'Valid email required' : '') & ok;
  ok = mSetErr('a-company', !mg('ma-company').value.trim()              ? 'Required'             : '') & ok;
  ok = mSetErr('a-role',    !mg('ma-role').value                        ? 'Please select a role' : '') & ok;
  ok = mSetErr('a-goal',    !mg('ma-goal').value                        ? 'Please select one'    : '') & ok;
  if (!ok) return;

  const btn = mg('ma-submit-btn');
  if (btn.disabled) return;
  mBtnLoading(btn);
  mg('mf-submit-err-a').textContent = '';

  const goalSel   = mg('ma-goal').value;
  const goalOther = mg('ma-goal-other') ? mg('ma-goal-other').querySelector('input') : null;
  const goalVal   = goalSel === 'other' && goalOther ? goalOther.value.trim() : goalSel;
  const toolChecks = ['crm','booking','google-alerts','meta-ads','email-newsletter','spreadsheet'];
  const toolsSelected = toolChecks.filter(t => {
    const el = mg('ma-chk-' + t);
    return el && el.checked;
  });
  const crmSel   = mg('ma-crm-sel');
  const crmOther = mg('ma-crm-other') ? mg('ma-crm-other').querySelector('input') : null;
  if (crmSel && crmSel.value) toolsSelected.push('CRM: ' + (crmSel.value === 'other' && crmOther ? crmOther.value.trim() : crmSel.value));
  const bookSel   = mg('ma-booking-sel');
  const bookOther = mg('ma-booking-other') ? mg('ma-booking-other').querySelector('input') : null;
  if (bookSel && bookSel.value) toolsSelected.push('Booking: ' + (bookSel.value === 'other' && bookOther ? bookOther.value.trim() : bookSel.value));

  netlifySubmit('early-access', {
    email:   mg('ma-email').value.trim(),
    company: mg('ma-company').value.trim(),
    role:    mg('ma-role').value,
    goal:    goalVal,
    tools:   toolsSelected.join(', ')
  })
    .then(function(res) {
      if (!res.ok) throw new Error('Network response was not ok');
      mg('mf-form-a').classList.add('hidden');
      mg('mf-success-a').classList.add('visible');
    })
    .catch(function() {
      mBtnReset(btn);
      mg('mf-submit-err-a').textContent = 'Something went wrong. Please try again.';
    });
}

function mSubmitB() {
  let ok = true;
  ok = mSetErr('b-email',   !mValidEmail(mg('mb-email').value.trim())   ? 'Valid email required' : '') & ok;
  ok = mSetErr('b-company', !mg('mb-company').value.trim()              ? 'Required'             : '') & ok;
  ok = mSetErr('b-role',    !mg('mb-role').value                        ? 'Please select a role' : '') & ok;
  ok = mSetErr('b-goal',    !mg('mb-goal').value                        ? 'Please select one'    : '') & ok;
  if (!ok) return;

  const btn = mg('mb-submit-btn');
  if (btn.disabled) return;
  mBtnLoading(btn);
  mg('mf-submit-err-b').textContent = '';

  const goalSel   = mg('mb-goal').value;
  const goalOther = mg('mb-goal-other') ? mg('mb-goal-other').querySelector('input') : null;
  const goalVal   = goalSel === 'other' && goalOther ? goalOther.value.trim() : goalSel;

  netlifySubmit('consultation', {
    email:   mg('mb-email').value.trim(),
    company: mg('mb-company').value.trim(),
    role:    mg('mb-role').value,
    goal:    goalVal,
    more:    mg('mb-more').value.trim()
  })
    .then(function(res) {
      if (!res.ok) throw new Error('Network response was not ok');
      mg('mf-form-b').classList.add('hidden');
      mg('mf-success-b').classList.add('visible');
    })
    .catch(function() {
      mBtnReset(btn);
      mg('mf-submit-err-b').textContent = 'Something went wrong. Please try again.';
    });
}

const mContactHints = {
  operator: "e.g. How does Wandar find posts? Does it work for East Africa operators?",
  partner:  "e.g. We run a booking platform and want to explore how Wandar could fit in.",
  press:    "e.g. Writing a piece on AI tools for the safari industry — happy to share details.",
  other:    "Tell us whatever is on your mind."
};
const mContactSuccess = {
  operator: { title: "Message received.", body: "We'll get back to you within 24 hours — personally, not from a bot." },
  partner:  { title: "Interesting.", body: "Someone from the team will reach out within 48 hours to explore the fit." },
  press:    { title: "Got it.", body: "We'll send over what you need within 24 hours." },
  other:    { title: "Message received.", body: "We'll get back to you within 24 hours." }
};
function mHandleContactIntent() {
  const val = mg('mc-intent').value;
  const ta  = mg('mc-message');
  const otherWrap = mg('mc-intent-other');
  otherWrap.classList.toggle('visible', val === 'other');
  if (val && mContactHints[val]) {
    ta.placeholder = mContactHints[val];
  } else {
    ta.placeholder = "Tell us how we can help...";
  }
  mSetErr('c-intent', '');
}
function mSubmitC() {
  let ok = true;
  ok = mSetErr('c-name',    !mg('mc-name').value.trim()                 ? 'Required'             : '') & ok;
  ok = mSetErr('c-company', !mg('mc-company').value.trim()              ? 'Required'             : '') & ok;
  ok = mSetErr('c-email',   !mValidEmail(mg('mc-email').value.trim())   ? 'Valid email required' : '') & ok;
  ok = mSetErr('c-intent',  !mg('mc-intent').value                      ? 'Please select one'    : '') & ok;
  ok = mSetErr('c-message', !mg('mc-message').value.trim()              ? 'Required'             : '') & ok;
  if (!ok) return;

  const btn = mg('mc-submit-btn');
  if (btn.disabled) return;
  mBtnLoading(btn);
  mg('mf-submit-err-c').textContent = '';

  const intent = mg('mc-intent').value;
  const s = mContactSuccess[intent] || mContactSuccess['other'];

  netlifySubmit('contact', {
    name:    mg('mc-name').value.trim(),
    company: mg('mc-company').value.trim(),
    email:   mg('mc-email').value.trim(),
    intent:  intent,
    message: mg('mc-message').value.trim()
  })
    .then(function(res) {
      if (!res.ok) throw new Error('Network response was not ok');
      mg('mc-success-title').textContent = s.title;
      mg('mc-success-body').textContent  = s.body;
      mg('mf-form-c').classList.add('hidden');
      mg('mf-success-c').classList.add('visible');
    })
    .catch(function() {
      mBtnReset(btn);
      mg('mf-submit-err-c').textContent = 'Something went wrong. Please try again.';
    });
}
