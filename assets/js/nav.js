document.addEventListener('DOMContentLoaded', function() {
  var hamburger    = document.getElementById('hamburger');
  var mobilePanel  = document.getElementById('mobile-panel');
  var navRelatives = Array.from(document.querySelectorAll('li.nav-relative'));

  // Desktop: hover-open with delay to bridge the gap between button and dropdown
  navRelatives.forEach(function(li) {
    var drop = li.querySelector('.platforms-dropdown, .resources-dropdown');
    if (!drop) return;

    var timer;

    function openDrop() {
      clearTimeout(timer);
      // Close all sibling dropdowns and remove their underlines
      navRelatives.forEach(function(otherLi) {
        if (otherLi === li) return;
        var otherDrop = otherLi.querySelector('.platforms-dropdown, .resources-dropdown');
        if (otherDrop) otherDrop.classList.remove('open');
        otherLi.classList.remove('nav-hover');
      });
      drop.classList.add('open');
      li.classList.add('nav-hover');
    }

    function closeDrop() {
      timer = setTimeout(function() {
        drop.classList.remove('open');
        li.classList.remove('nav-hover');
      }, 120);
    }

    li.addEventListener('mouseenter', openDrop);
    li.addEventListener('mouseleave', closeDrop);
    drop.addEventListener('mouseenter', function() { clearTimeout(timer); });
    drop.addEventListener('mouseleave', closeDrop);
  });

  // Hamburger / mobile panel
  if (hamburger && mobilePanel) {
    hamburger.addEventListener('click', function() {
      var isOpen = mobilePanel.classList.contains('open');
      mobilePanel.classList.toggle('open');
      hamburger.classList.toggle('open');
      hamburger.setAttribute('aria-expanded', !isOpen);
    });
  }

  // Escape key closes everything
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      navRelatives.forEach(function(li) {
        var d = li.querySelector('.platforms-dropdown, .resources-dropdown');
        if (d) d.classList.remove('open');
      });
      if (mobilePanel) mobilePanel.classList.remove('open');
      if (hamburger)   { hamburger.classList.remove('open'); hamburger.setAttribute('aria-expanded', 'false'); }
    }
  });

  window.closeMobileMenu = function() {
    if (mobilePanel) mobilePanel.classList.remove('open');
    if (hamburger)   { hamburger.classList.remove('open'); hamburger.setAttribute('aria-expanded', 'false'); }
  };

  window.toggleMobilePlatforms = function() {
    var mp = document.getElementById('mobile-platforms');
    if (mp) mp.classList.toggle('open');
  };

  window.toggleMobileResources = function() {
    var mr = document.getElementById('mobile-resources');
    if (mr) mr.classList.toggle('open');
  };
});
