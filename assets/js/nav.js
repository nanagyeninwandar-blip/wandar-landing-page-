document.addEventListener('DOMContentLoaded', function() {
  var hamburger    = document.getElementById('hamburger');
  var mobilePanel  = document.getElementById('mobile-panel');
  var navRelatives = Array.from(document.querySelectorAll('li.nav-relative'));

  // ── Desktop: hover-open mega dropdowns ──
  navRelatives.forEach(function(li) {
    var drop = li.querySelector('.platforms-dropdown, .resources-dropdown');
    if (!drop) return;
    var timer;
    function openDrop() {
      clearTimeout(timer);
      navRelatives.forEach(function(o) {
        if (o === li) return;
        var d = o.querySelector('.platforms-dropdown, .resources-dropdown');
        if (d) d.classList.remove('open');
        o.classList.remove('nav-hover');
      });
      drop.classList.add('open');
      li.classList.add('nav-hover');
    }
    function closeDrop() { timer = setTimeout(function() { drop.classList.remove('open'); li.classList.remove('nav-hover'); }, 120); }
    li.addEventListener('mouseenter', openDrop);
    li.addEventListener('mouseleave', closeDrop);
    drop.addEventListener('mouseenter', function() { clearTimeout(timer); });
    drop.addEventListener('mouseleave', closeDrop);
  });

  // ── Mobile menu (single owner of the hamburger) ──
  function openMenu() {
    if (!mobilePanel) return;
    mobilePanel.classList.add('open');
    if (hamburger) { hamburger.classList.add('open'); hamburger.setAttribute('aria-expanded', 'true'); }
    document.body.classList.add('nav-locked');
  }
  function closeMenu() {
    if (mobilePanel) {
      mobilePanel.classList.remove('open');
      mobilePanel.querySelectorAll('.mnav__group.open').forEach(function(g) {
        g.classList.remove('open');
        var b = g.querySelector('.mnav__acc'); if (b) b.setAttribute('aria-expanded', 'false');
      });
    }
    if (hamburger) { hamburger.classList.remove('open'); hamburger.setAttribute('aria-expanded', 'false'); }
    document.body.classList.remove('nav-locked');
  }
  window.closeMobileMenu = closeMenu;

  if (hamburger && mobilePanel) {
    hamburger.addEventListener('click', function() {
      mobilePanel.classList.contains('open') ? closeMenu() : openMenu();
    });
    var closeBtn = mobilePanel.querySelector('.mnav__close');
    if (closeBtn) closeBtn.addEventListener('click', closeMenu);

    mobilePanel.querySelectorAll('.mnav__acc').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var g = btn.closest('.mnav__group'); if (!g) return;
        var open = g.classList.toggle('open');
        btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
    });
    // tapping a real link closes the menu
    mobilePanel.querySelectorAll('a[href]').forEach(function(a) {
      a.addEventListener('click', function() { setTimeout(closeMenu, 10); });
    });
  }

  // ── Escape closes everything ──
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      navRelatives.forEach(function(li) {
        var d = li.querySelector('.platforms-dropdown, .resources-dropdown');
        if (d) d.classList.remove('open');
      });
      closeMenu();
    }
  });

  // Legacy no-ops (kept so any old inline markup never errors)
  window.toggleMobilePlatforms = function() { var mp = document.getElementById('mobile-platforms'); if (mp) mp.classList.toggle('open'); };
  window.toggleMobileResources = function() { var mr = document.getElementById('mobile-resources'); if (mr) mr.classList.toggle('open'); };
});
