/* =====================================================================
   WANDAR — Billing-period toggle behaviour (SECTION-ONLY script)
   Powers the Monthly / Quarterly / Annual selector on the
   pricing card. Self-contained; safe to drop in once per page.

   VERIFY these numbers against your real pricing before shipping.
   ===================================================================== */
(function () {
  var PLANS = {
    monthly:   { amount: '249', billedTotal: '$249',   billedWord: 'billed monthly',   save: null },
    quarterly: { amount: '199', billedTotal: '$597',   billedWord: 'billed quarterly', save: '20%' },
    annual:    { amount: '149', billedTotal: '$1,788', billedWord: 'billed annually',  save: '40%' }
  };

  function init() {
    var opts     = document.querySelectorAll('.billing-opt');
    var amountEl = document.getElementById('gc-amount');
    var billedEl = document.getElementById('gc-billed');
    if (!opts.length || !amountEl || !billedEl) return;

    function render(period) {
      var p = PLANS[period];
      if (!p) return;
      amountEl.textContent = p.amount;
      var saveHtml = p.save ? ' <span class="gc-save-pill">\u00B7 Save ' + p.save + '</span>' : '';
      billedEl.innerHTML = '<strong>' + p.billedTotal + '</strong> ' + p.billedWord + saveHtml;
      [amountEl, billedEl].forEach(function (el) {
        el.classList.remove('gc-anim');
        void el.offsetWidth;       /* restart the fade animation */
        el.classList.add('gc-anim');
      });
    }

    opts.forEach(function (btn) {
      btn.addEventListener('click', function () {
        opts.forEach(function (o) { o.classList.remove('is-active'); o.setAttribute('aria-selected', 'false'); });
        btn.classList.add('is-active');
        btn.setAttribute('aria-selected', 'true');
        render(btn.dataset.period);
      });
    });

    render('quarterly');  /* default selection */
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
