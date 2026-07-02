/* Wandar · Live demand marquee builder (no dependencies, defer).
   Finds every <section class="wandar-demand" data-platform="…">, reads that
   platform's image list from window.WANDAR_DEMAND (manifest.js), and builds
   the two-row marquee. Empty platform → section hidden entirely. */
(function () {
  'use strict';

  var DISPLAY_NAMES = {
    reddit: 'Reddit', tripadvisor: 'TripAdvisor', quora: 'Quora',
    facebook: 'Facebook', instagram: 'Instagram', tiktok: 'TikTok',
    x: 'X', pinterest: 'Pinterest', bluesky: 'Bluesky'
  };

  function cardSrc(platform, file) {
    // Allow absolute/data URLs (useful for previews); else resolve to the platform folder.
    if (/^(data:|https?:|\/)/.test(file)) return file;
    return '/assets/demand/' + platform + '/' + file;
  }

  function buildCard(platform, file) {
    var fig = document.createElement('figure');
    fig.className = 'wc-card';
    var img = document.createElement('img');
    img.src = cardSrc(platform, file);
    img.alt = (DISPLAY_NAMES[platform] || platform) + ' post showing safari booking intent';
    img.loading = 'lazy';
    fig.appendChild(img);
    return fig;
  }

  function buildRow(section, platform, files, reverse) {
    var row = document.createElement('div');
    row.className = 'wc-row' + (reverse ? ' wc-row--reverse' : '');
    var track = document.createElement('div');
    track.className = 'wc-track';
    var group = document.createElement('div');
    group.className = 'wc-group';

    function appendSet(isRepeat) {
      files.forEach(function (file) {
        var card = buildCard(platform, file);
        if (isRepeat) card.setAttribute('data-dup', 'true'); // hidden under reduced motion
        group.appendChild(card);
      });
    }

    appendSet(false);
    track.appendChild(group);
    row.appendChild(track);
    section.appendChild(row);

    // Seamless rule: repeat the set until the group is at least as wide as
    // the container, THEN clone the whole group once (aria-hidden). The CSS
    // animates the track 0 → -50%, i.e. exactly one group width.
    // Card widths are fixed in CSS, so offsetWidth is reliable pre-image-load.
    var container = row.clientWidth || section.clientWidth || window.innerWidth;
    var guard = 0;
    while (group.offsetWidth < container && guard < 30) {
      appendSet(true);
      guard++;
    }

    var clone = group.cloneNode(true);
    clone.setAttribute('aria-hidden', 'true');
    track.appendChild(clone);
  }

  function init() {
    var sections = document.querySelectorAll('section.wandar-demand[data-platform]');
    Array.prototype.forEach.call(sections, function (section) {
      var platform = section.getAttribute('data-platform');
      var manifest = window.WANDAR_DEMAND || {};
      var files = manifest[platform] || [];

      if (!files.length) {
        section.style.display = 'none';
        return;
      }

      var rows;
      if (files.length < 4) {
        rows = [files]; // single row
      } else {
        var row1 = files.filter(function (_, i) { return i % 2 === 1; }); // odd-indexed
        var row2 = files.filter(function (_, i) { return i % 2 === 0; }); // even-indexed
        rows = [row1, row2];
      }

      rows.forEach(function (rowFiles, idx) {
        if (rowFiles.length) buildRow(section, platform, rowFiles, idx === 1);
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
