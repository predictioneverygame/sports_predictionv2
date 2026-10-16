(function () {
  'use strict';

  var gsap = window.gsap;
  if (!gsap || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var hasScrollTrigger = !!window.ScrollTrigger;
  if (hasScrollTrigger) gsap.registerPlugin(window.ScrollTrigger);

  gsap.defaults({ ease: 'power2.out', duration: 0.6 });

  var revealSelector = [
    '#daily-recs .sidebar > .sb-card',
    '#season-summary .kpi-card',
    '#charts .chart-card',
    '#recent-records .records-table-wrap',
    '#settled-history > .section-head',
    '#leagues .league-index-title',
    '#leagues .league-list',
    '.home-about',
    '#page-league-charts .league-charts-head',
    '#page-league-charts .chart-card',
    '#page-about .about-hero',
    '#page-about .about-box',
    '#page-worldcup .wc-page-head'
  ].join(',');

  var rowTriggers = new WeakMap();
  var refreshTimer = 0;
  var activePage = null;

  function scheduleRefresh() {
    if (!hasScrollTrigger) return;
    window.clearTimeout(refreshTimer);
    refreshTimer = window.setTimeout(function () {
      window.ScrollTrigger.refresh();
    }, 120);
  }

  function revealPageElements(page) {
    if (!page || !hasScrollTrigger) return;
    var elements = Array.prototype.slice.call(page.querySelectorAll(revealSelector));
    elements = elements.filter(function (element) {
      if (element.dataset.gsapRevealBound === '1') return false;
      element.dataset.gsapRevealBound = '1';
      return true;
    });
    if (!elements.length) return;

    gsap.set(elements, { autoAlpha: 0, y: 18 });
    window.ScrollTrigger.batch(elements, {
      start: 'top 90%',
      once: true,
      onEnter: function (batch) {
        gsap.fromTo(batch,
          { autoAlpha: 0, y: 18 },
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.58,
            stagger: 0.07,
            ease: 'power2.out',
            clearProps: 'transform,opacity,visibility',
            overwrite: 'auto'
          }
        );
      }
    });
    scheduleRefresh();
  }

  function animatePageIntro(page) {
    if (!page) return;
    var targets;
    if (page.id === 'page-home') {
      targets = page.querySelectorAll('.hero-main > *, .hero-facts > div, .hero-line');
    } else {
      var intro = page.querySelector('.about-hero, .league-charts-head, .wc-page-head, .match-header, .league-header, h1');
      targets = intro ? [intro] : [];
    }
    if (!targets.length) return;
    gsap.from(targets, {
      autoAlpha: 0,
      y: 14,
      duration: 0.52,
      stagger: 0.065,
      ease: 'power2.out',
      clearProps: 'transform,opacity,visibility',
      overwrite: 'auto'
    });
  }

  function animateDateRows(container) {
    if (!container || !hasScrollTrigger) return;
    var previous = rowTriggers.get(container) || [];
    previous.forEach(function (trigger) { trigger.kill(); });

    var rows = Array.prototype.filter.call(container.children, function (child) {
      return child.classList && child.classList.contains('date-row');
    });
    if (!rows.length) return;

    rows.forEach(function (row) { row.dataset.gsapRowBound = '1'; });
    gsap.set(rows, { autoAlpha: 0, y: 12 });
    var triggers = window.ScrollTrigger.batch(rows, {
      start: 'top 94%',
      once: true,
      onEnter: function (batch) {
        gsap.fromTo(batch,
          { autoAlpha: 0, y: 12 },
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.44,
            stagger: 0.045,
            ease: 'power2.out',
            clearProps: 'transform,opacity,visibility',
            overwrite: 'auto'
          }
        );
      }
    });
    rowTriggers.set(container, triggers);
    scheduleRefresh();
  }

  function observeDateRows() {
    if (!hasScrollTrigger || !('MutationObserver' in window)) return;
    ['date-list', 'settled-list'].forEach(function (id) {
      var container = document.getElementById(id);
      if (!container) return;
      var observer = new MutationObserver(function () {
        window.requestAnimationFrame(function () { animateDateRows(container); });
      });
      observer.observe(container, { childList: true });
    });
  }

  function activatePage(page) {
    if (!page || page === activePage) return;
    activePage = page;
    window.requestAnimationFrame(function () {
      animatePageIntro(page);
      revealPageElements(page);
      if (hasScrollTrigger) scheduleRefresh();
    });
  }

  function observePages() {
    if (!('MutationObserver' in window)) return;
    var pages = document.querySelectorAll('.page');
    var observer = new MutationObserver(function () {
      activatePage(document.querySelector('.page.active'));
    });
    pages.forEach(function (page) {
      observer.observe(page, { attributes: true, attributeFilter: ['class'] });
    });
  }

  activatePage(document.querySelector('.page.active'));
  observePages();
  observeDateRows();

  if (hasScrollTrigger) {
    window.addEventListener('load', scheduleRefresh, { once: true });
    window.addEventListener('resize', scheduleRefresh, { passive: true });
  }
})();
