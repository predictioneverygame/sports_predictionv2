/**
 * SportsRS UI layer — visuals only. Reads MATCHES / DOM; does not change business logic.
 */
(function () {
  'use strict';

  var charts = { winrate: null, roi: null, monthly: null };
  var UNIT = 10600;
  var BANKROLL = 20;

  function qs(id) { return document.getElementById(id); }

  function showToast(msg) {
    var host = qs('toast-host');
    if (!host) return;
    var el = document.createElement('div');
    el.className = 'toast';
    el.textContent = msg;
    host.appendChild(el);
    setTimeout(function () {
      el.style.opacity = '0';
      setTimeout(function () { el.remove(); }, 280);
    }, 2800);
  }

  function countUp(el, target, opts) {
    if (!el) return;
    opts = opts || {};
    var decimals = opts.decimals != null ? opts.decimals : 0;
    var suffix = opts.suffix || '';
    var prefix = opts.prefix || '';
    var duration = opts.duration || 900;
    var start = performance.now();
    var from = 0;

    function frame(now) {
      var t = Math.min(1, (now - start) / duration);
      var eased = 1 - Math.pow(1 - t, 3);
      var val = from + (target - from) * eased;
      if (decimals > 0) {
        el.textContent = prefix + val.toFixed(decimals) + suffix;
      } else {
        el.textContent = prefix + Math.round(val) + suffix;
      }
      if (t < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  function setupNavBlur() {
    var nav = qs('site-nav');
    if (!nav) return;
    function onScroll() {
      nav.classList.toggle('scrolled', window.scrollY > 12);
      var btn = qs('back-to-top');
      if (btn) btn.classList.toggle('visible', window.scrollY > 480);
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  function setupBackToTop() {
    var btn = qs('back-to-top');
    if (!btn) return;
    btn.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  function setupReveal() {
    var nodes = document.querySelectorAll('.reveal');
    if (!nodes.length || !('IntersectionObserver' in window)) {
      nodes.forEach(function (n) { n.classList.add('visible'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.classList.add('visible');
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    nodes.forEach(function (n) { io.observe(n); });
  }

  function hideSkeleton() {
    var sk = qs('daily-recs-skeleton');
    if (sk) sk.style.display = 'none';
  }

  function initLucide() {
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      try { window.lucide.createIcons(); } catch (_) {}
    }
  }

  function getFinals() {
    var list = (typeof MATCHES !== 'undefined' && Array.isArray(MATCHES)) ? MATCHES : [];
    return list.filter(function (m) { return m && m.status === 'final'; });
  }

  function calcProfit(m) {
    if (typeof calcProfitForMatch === 'function') return calcProfitForMatch(m);
    var p = Number(m.profit);
    return isNaN(p) ? 0 : p;
  }

  function tallyHitMiss(finals) {
    var hit = 0;
    var miss = 0;
    if (typeof tallyPredictionsByLeague === 'function') {
      var t = tallyPredictionsByLeague(finals);
      return { hit: t.totalHit || 0, miss: t.totalMiss || 0 };
    }
    finals.forEach(function (m) {
      var r = String(m.prediction_result || '');
      if (r === 'hit' || r === 'half_hit') hit += 1;
      else if (r === 'miss' || r === 'half_miss') miss += 1;
    });
    return { hit: hit, miss: miss };
  }

  function aggregateKpis() {
    var finals = getFinals();
    var split = (typeof SEASON_SPLIT_DATE !== 'undefined') ? SEASON_SPLIT_DATE : '2026-07-17';
    var season2627 = finals.filter(function (m) { return String(m.date || '') >= split; });
    var rows = season2627.length ? season2627 : finals;

    var totalProfit = 0;
    rows.forEach(function (m) { totalProfit += calcProfit(m); });
    var units = UNIT > 0 ? totalProfit / UNIT : 0;
    var roi = (units / BANKROLL) * 100;

    var hm = tallyHitMiss(rows);
    var denom = hm.hit + hm.miss;
    var winRate = denom > 0 ? (hm.hit / denom) * 100 : 0;

    return {
      totalPicks: rows.length,
      winRate: winRate,
      roi: roi,
      units: units
    };
  }

  function updateKpis() {
    var k = aggregateKpis();
    var picksEl = qs('kpi-total-picks');
    var wrEl = qs('kpi-win-rate');
    var roiEl = qs('kpi-roi');
    var unitsEl = qs('kpi-units');

    countUp(picksEl, k.totalPicks, { decimals: 0 });
    if (wrEl) {
      wrEl.classList.remove('pos', 'neg');
      wrEl.classList.add(k.winRate < 52 ? 'neg' : 'pos');
      countUp(wrEl, k.winRate, { decimals: 1, suffix: '%' });
    }

    if (roiEl) {
      roiEl.classList.remove('pos', 'neg');
      if (k.roi > 0) roiEl.classList.add('pos');
      else if (k.roi < 0) roiEl.classList.add('neg');
      var prefix = k.roi > 0 ? '+' : '';
      countUp(roiEl, k.roi, { decimals: 2, suffix: '%', prefix: prefix });
    }
    if (unitsEl) {
      unitsEl.classList.remove('pos', 'neg');
      if (k.units > 0) unitsEl.classList.add('pos');
      else if (k.units < 0) unitsEl.classList.add('neg');
      var up = k.units > 0 ? '+' : '';
      countUp(unitsEl, k.units, { decimals: 2, prefix: up });
    }
  }

  function monthKey(dateStr) {
    return String(dateStr || '').slice(0, 7);
  }

  function hitMissForMatch(m) {
    var hit = 0;
    var miss = 0;
    if (m && m.prediction && typeof derivePredictionDisplayResult === 'function' && typeof applyResultToPredTally === 'function') {
      Object.values(m.prediction).forEach(function (p) {
        var r = derivePredictionDisplayResult(m, p);
        var d = { hit: 0, miss: 0 };
        applyResultToPredTally(m, r, d);
        hit += d.hit;
        miss += d.miss;
      });
      return { hit: hit, miss: miss };
    }
    var r = String(m && m.prediction_result || '');
    if (r === 'hit' || r === 'half_hit') hit = 1;
    else if (r === 'miss' || r === 'half_miss') miss = 1;
    return { hit: hit, miss: miss };
  }

  function buildMonthlySeries() {
    var finals = getFinals().slice().sort(function (a, b) {
      return String(a.date).localeCompare(String(b.date));
    });
    var map = {};
    finals.forEach(function (m) {
      var key = monthKey(m.date);
      if (!key || key.length < 7) return;
      if (!map[key]) map[key] = { profit: 0, hit: 0, miss: 0, count: 0 };
      map[key].profit += calcProfit(m);
      map[key].count += 1;
      var hm = hitMissForMatch(m);
      map[key].hit += hm.hit;
      map[key].miss += hm.miss;
    });
    var keys = Object.keys(map).sort();
    if (keys.length > 8) keys = keys.slice(-8);
    return keys.map(function (k) {
      var row = map[k];
      var denom = row.hit + row.miss;
      var wr = denom > 0 ? (row.hit / denom) * 100 : 0;
      var units = UNIT > 0 ? row.profit / UNIT : 0;
      var roi = (units / BANKROLL) * 100;
      return { label: k.slice(5), winRate: wr, roi: roi, profitUnits: units };
    });
  }

  function chartDefaults() {
    if (!window.Chart) return;
    Chart.defaults.color = '#BFC8D6';
    Chart.defaults.borderColor = 'rgba(255,255,255,0.08)';
    Chart.defaults.font.family = 'Inter, sans-serif';
  }

  function renderCharts() {
    if (!window.Chart) {
      setTimeout(renderCharts, 200);
      return;
    }
    chartDefaults();
    var series = buildMonthlySeries();
    var labels = series.map(function (s) { return s.label; });
    if (!labels.length) {
      labels = ['—'];
      series = [{ winRate: 0, roi: 0, profitUnits: 0 }];
    }

    var commonOpts = {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          enabled: false,
          external: function (context) {
            var tooltipEl = document.getElementById('chartjs-tooltip');
            if (!tooltipEl) {
              tooltipEl = document.createElement('div');
              tooltipEl.id = 'chartjs-tooltip';
              tooltipEl.style.cssText = [
                'position:absolute',
                'pointer-events:none',
                'z-index:50',
                'transform:translate(-50%,-120%)',
                'font-family:Inter,sans-serif',
                'font-size:13px',
                'font-weight:700',
                'letter-spacing:0.02em',
                'padding:2px 0',
                'text-shadow:0 0 6px #05070B,0 0 10px #05070B,0 1px 2px #05070B,0 -1px 2px #05070B',
                'transition:opacity .12s ease',
                'opacity:0'
              ].join(';');
              document.body.appendChild(tooltipEl);
            }

            var tooltip = context.tooltip;
            if (!tooltip || tooltip.opacity === 0 || !tooltip.dataPoints || !tooltip.dataPoints.length) {
              tooltipEl.style.opacity = '0';
              return;
            }

            var point = null;
            for (var i = 0; i < tooltip.dataPoints.length; i++) {
              if (tooltip.dataPoints[i].datasetIndex === 0) {
                point = tooltip.dataPoints[i];
                break;
              }
            }
            if (!point) point = tooltip.dataPoints[0];
            var v = Number(point.parsed.y);
            if (isNaN(v)) {
              tooltipEl.style.opacity = '0';
              return;
            }
            var canvas = context.chart.canvas;
            var chartId = canvas && canvas.id;
            if (chartId === 'chart-winrate') {
              tooltipEl.textContent = v.toFixed(1) + '%';
              tooltipEl.style.color = v < 52 ? '#FF5D73' : '#32D583';
            } else if (chartId === 'chart-roi') {
              var roiPrefix = v > 0 ? '+' : '';
              tooltipEl.textContent = roiPrefix + v.toFixed(2) + '%';
              tooltipEl.style.color = v < 0 ? '#FF5D73' : (v > 0 ? '#32D583' : '#BFC8D6');
            } else if (chartId === 'chart-monthly') {
              var unitPrefix = v > 0 ? '+' : '';
              tooltipEl.textContent = unitPrefix + v.toFixed(2) + ' Unit';
              tooltipEl.style.color = v < 0 ? '#FF5D73' : (v > 0 ? '#32D583' : '#BFC8D6');
            } else {
              var prefix = v > 0 ? '+' : '';
              tooltipEl.textContent = prefix + v.toFixed(2);
              tooltipEl.style.color = v < 0 ? '#FF5D73' : (v > 0 ? '#32D583' : '#BFC8D6');
            }

            var rect = canvas.getBoundingClientRect();
            var left = rect.left + window.scrollX + tooltip.caretX;
            var top = rect.top + window.scrollY + tooltip.caretY;
            tooltipEl.style.left = left + 'px';
            tooltipEl.style.top = top + 'px';
            tooltipEl.style.opacity = '1';
          }
        }
      },
      scales: {
        x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { maxRotation: 0 } },
        y: { grid: { color: 'rgba(255,255,255,0.06)' } }
      }
    };

    function line(id, data, color, key, opts) {
      opts = opts || {};
      var canvas = qs(id);
      if (!canvas) return null;
      if (charts[key]) charts[key].destroy();

      var datasets = [{
        data: data,
        borderColor: color,
        backgroundColor: color + '22',
        fill: true,
        tension: 0.35,
        pointRadius: 3,
        pointHoverRadius: 5,
        pointBackgroundColor: color,
        pointBorderColor: color,
        borderWidth: 2,
        order: 0
      }];

      if (opts.zeroLine) {
        datasets.push({
          data: labels.map(function () { return 0; }),
          borderColor: 'rgba(255,255,255,0.75)',
          borderWidth: 2,
          borderDash: [6, 4],
          pointRadius: 0,
          pointHoverRadius: 0,
          fill: false,
          tension: 0,
          order: 2
        });
      }

      var chartOpts = Object.assign({}, commonOpts, {
        scales: {
          x: commonOpts.scales.x,
          y: Object.assign({}, commonOpts.scales.y, opts.zeroLine ? {
            grace: '8%',
            grid: {
              color: function (ctx) {
                return ctx.tick && Number(ctx.tick.value) === 0
                  ? 'rgba(255,255,255,0.28)'
                  : 'rgba(255,255,255,0.06)';
              },
              lineWidth: function (ctx) {
                return ctx.tick && Number(ctx.tick.value) === 0 ? 1.25 : 1;
              }
            }
          } : {})
        }
      });

      charts[key] = new Chart(canvas, {
        type: 'line',
        data: { labels: labels, datasets: datasets },
        options: chartOpts
      });
      return charts[key];
    }

    line('chart-winrate', series.map(function (s) { return Number(s.winRate.toFixed(2)); }), '#00E5FF', 'winrate');
    line('chart-roi', series.map(function (s) { return Number(s.roi.toFixed(2)); }), '#5B8CFF', 'roi', { zeroLine: true });
    line('chart-monthly', series.map(function (s) { return Number(s.profitUnits.toFixed(2)); }), '#7C3AED', 'monthly', { zeroLine: true });
  }

  function refresh() {
    hideSkeleton();
    updateKpis();
    renderCharts();
    initLucide();
  }

  function boot() {
    setupNavBlur();
    setupBackToTop();
    setupReveal();
    initLucide();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  window.SportsRSUI = {
    refresh: refresh,
    showToast: showToast,
    hideSkeleton: hideSkeleton
  };
})();
