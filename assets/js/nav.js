// Shared nav interactivity — used by index.html and all guide/blog pages
(function() {
  var platformsBtn  = document.getElementById('platforms-btn');
  var platformsDrop = document.getElementById('platforms-dropdown');
  var resourcesBtn  = document.getElementById('resources-btn');
  var resourcesDrop = document.getElementById('resources-dropdown');
  var hamburger     = document.getElementById('hamburger');
  var mobilePanel   = document.getElementById('mobile-panel');

  // Platforms dropdown
  if (platformsBtn && platformsDrop) {
    platformsBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      var isOpen = platformsDrop.classList.contains('open');
      platformsDrop.classList.toggle('open');
      platformsBtn.classList.toggle('open');
      platformsBtn.setAttribute('aria-expanded', !isOpen);
      // close resources if open
      if (resourcesDrop) { resourcesDrop.classList.remove('open'); }
      if (resourcesBtn)  { resourcesBtn.classList.remove('open'); resourcesBtn.setAttribute('aria-expanded', 'false'); }
    });
  }

  // Resources dropdown
  if (resourcesBtn && resourcesDrop) {
    resourcesBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      var isOpen = resourcesDrop.classList.contains('open');
      resourcesDrop.classList.toggle('open');
      resourcesBtn.classList.toggle('open');
      resourcesBtn.setAttribute('aria-expanded', !isOpen);
      // close platforms if open
      if (platformsDrop) { platformsDrop.classList.remove('open'); }
      if (platformsBtn)  { platformsBtn.classList.remove('open'); platformsBtn.setAttribute('aria-expanded', 'false'); }
    });
  }

  // Click outside — close both dropdowns
  document.addEventListener('click', function(e) {
    if (platformsBtn && platformsDrop) {
      if (!platformsBtn.contains(e.target) && !platformsDrop.contains(e.target)) {
        platformsDrop.classList.remove('open');
        platformsBtn.classList.remove('open');
        platformsBtn.setAttribute('aria-expanded', 'false');
      }
    }
    if (resourcesBtn && resourcesDrop) {
      if (!resourcesBtn.contains(e.target) && !resourcesDrop.contains(e.target)) {
        resourcesDrop.classList.remove('open');
        resourcesBtn.classList.remove('open');
        resourcesBtn.setAttribute('aria-expanded', 'false');
      }
    }
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

  // Close nav elements on Escape
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      if (platformsDrop) { platformsDrop.classList.remove('open'); }
      if (platformsBtn)  { platformsBtn.classList.remove('open'); platformsBtn.setAttribute('aria-expanded', 'false'); }
      if (resourcesDrop) { resourcesDrop.classList.remove('open'); }
      if (resourcesBtn)  { resourcesBtn.classList.remove('open'); resourcesBtn.setAttribute('aria-expanded', 'false'); }
      if (mobilePanel)   { mobilePanel.classList.remove('open'); }
      if (hamburger)     { hamburger.classList.remove('open'); hamburger.setAttribute('aria-expanded', 'false'); }
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
})();
