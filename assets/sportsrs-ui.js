/**
 * SportsRS UI layer — visuals only. Reads MATCHES / DOM; does not change business logic.
 */
(function () {
  'use strict';

  var charts = { winrate: null, monthly: null, cumulative: null, leagueWr: null, leagueRoi: null, leagueUnits: null };
  var UNIT = 10600;
  var BANKROLL = 20;
  var monthlyMetric = 'roi';
  var cumulMetric = 'roi';
  var chartSport = 'all';
  var leagueChartSport = 'all';
  var monthlySeriesCache = [];
  var cumulPointsCache = [];
  var leagueCompareCache = [];
  var leagueChartsSportBound = false;

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

  function getChartFinals() {
    return getFinals().filter(function (m) {
      if (typeof isWorldCupRelated === 'function' && isWorldCupRelated(m)) return false;
      return true;
    });
  }

  function matchSportKey(m) {
    var s = String(m && m.sport || '').toLowerCase();
    if (s === 'basketball') return 'basketball';
    if (s === 'soccer' || s === 'football') return 'soccer';
    return '';
  }

  function filterByChartSport(list) {
    if (chartSport === 'all') return list;
    return list.filter(function (m) { return matchSportKey(m) === chartSport; });
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
    var finals = filterByChartSport(getChartFinals()).slice().sort(function (a, b) {
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
    var keys = Object.keys(map).sort().filter(function (k) {
      var row = map[k];
      // 該月沒有可計場次就不畫點（避免無賽／空月顯示 0）
      return row && row.count > 0 && (row.hit + row.miss > 0 || Math.abs(row.profit) > 1e-9);
    });
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

  function matchTitle(m) {
    var home = (m.home && m.home.name) || m.home_name || '主隊';
    var away = (m.away && m.away.name) || m.away_name || '客隊';
    return home + ' vs ' + away;
  }

  function buildCumulativePoints() {
    var split = (typeof SEASON_SPLIT_DATE !== 'undefined') ? SEASON_SPLIT_DATE : '2026-07-17';
    var finals = filterByChartSport(getChartFinals()).filter(function (m) {
      return String(m.date || '') >= split;
    });
    if (!finals.length) finals = filterByChartSport(getChartFinals());
    finals = finals.slice().sort(function (a, b) {
      var dc = String(a.date || '').localeCompare(String(b.date || ''));
      if (dc !== 0) return dc;
      return String(a.time || '').localeCompare(String(b.time || ''));
    });

    var runningUnits = 0;
    var runningRoi = 0;
    return finals.map(function (m, idx) {
      var profit = calcProfit(m);
      var units = UNIT > 0 ? profit / UNIT : 0;
      var matchRoi = (units / BANKROLL) * 100;
      runningUnits += units;
      runningRoi += matchRoi;
      return {
        index: idx + 1,
        label: String(idx + 1),
        date: String(m.date || ''),
        time: String(m.time || ''),
        league: String(m.league || ''),
        title: matchTitle(m),
        profit: profit,
        matchUnits: units,
        matchRoi: matchRoi,
        cumulUnits: runningUnits,
        cumulRoi: runningRoi
      };
    });
  }

  function chartDefaults() {
    if (!window.Chart) return;
    Chart.defaults.color = '#BFC8D6';
    Chart.defaults.borderColor = 'rgba(255,255,255,0.08)';
    Chart.defaults.font.family = 'Inter, sans-serif';
  }

  function ensureTooltipEl() {
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
        'font-size:12px',
        'font-weight:700',
        'letter-spacing:0.01em',
        'line-height:1.45',
        'white-space:pre-line',
        'text-align:center',
        'padding:2px 0',
        'text-shadow:0 0 6px #05070B,0 0 10px #05070B,0 1px 2px #05070B,0 -1px 2px #05070B',
        'transition:opacity .12s ease',
        'opacity:0'
      ].join(';');
      document.body.appendChild(tooltipEl);
    }
    return tooltipEl;
  }

  function positionTooltip(tooltipEl, context, tooltip) {
    var canvas = context.chart.canvas;
    var rect = canvas.getBoundingClientRect();
    tooltipEl.style.left = (rect.left + window.scrollX + tooltip.caretX) + 'px';
    tooltipEl.style.top = (rect.top + window.scrollY + tooltip.caretY) + 'px';
    tooltipEl.style.opacity = '1';
  }

  function signedText(v, decimals, suffix) {
    var prefix = v > 0 ? '+' : '';
    return prefix + Number(v).toFixed(decimals) + (suffix || '');
  }

  function signedColor(v) {
    if (v < 0) return '#FF5D73';
    if (v > 0) return '#32D583';
    return '#BFC8D6';
  }

  function zeroLinePlugin() {
    return {
      id: 'sportsrsZeroLine',
      afterDatasetsDraw: function (chart) {
        if (!chart.options.plugins || !chart.options.plugins.sportsrsZeroLine || !chart.options.plugins.sportsrsZeroLine.enabled) {
          return;
        }
        var yScale = chart.scales.y;
        if (!yScale) return;
        var y = yScale.getPixelForValue(0);
        if (y < chart.chartArea.top || y > chart.chartArea.bottom) return;
        var ctx = chart.ctx;
        ctx.save();
        ctx.beginPath();
        ctx.setLineDash([6, 4]);
        ctx.lineWidth = 2;
        ctx.strokeStyle = 'rgba(255,255,255,0.8)';
        ctx.moveTo(chart.chartArea.left, y);
        ctx.lineTo(chart.chartArea.right, y);
        ctx.stroke();
        ctx.restore();
      }
    };
  }

  function makeBaseOpts(tooltipFormatter) {
    return {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'nearest', intersect: false, axis: 'x' },
      plugins: {
        legend: { display: false },
        sportsrsZeroLine: { enabled: true },
        tooltip: {
          enabled: false,
          external: function (context) {
            var tooltipEl = ensureTooltipEl();
            var tooltip = context.tooltip;
            if (!tooltip || tooltip.opacity === 0 || !tooltip.dataPoints || !tooltip.dataPoints.length) {
              tooltipEl.style.opacity = '0';
              return;
            }
            var point = tooltip.dataPoints[0];
            var info = tooltipFormatter(context.chart, point);
            if (!info) {
              tooltipEl.style.opacity = '0';
              return;
            }
            tooltipEl.textContent = info.text;
            tooltipEl.style.color = info.color || '#fff';
            positionTooltip(tooltipEl, context, tooltip);
          }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255,255,255,0.04)' },
          ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 8 }
        },
        y: {
          grace: '8%',
          grid: { color: 'rgba(255,255,255,0.06)' }
        }
      }
    };
  }

  function renderWinRateChart() {
    var series = monthlySeriesCache;
    var labels = series.map(function (s) { return s.label; });
    if (!labels.length) {
      labels = ['—'];
      series = [{ winRate: 0 }];
    }
    var data = series.map(function (s) { return Number((s.winRate || 0).toFixed(2)); });
    var canvas = qs('chart-winrate');
    if (!canvas) return;
    if (charts.winrate) charts.winrate.destroy();

    charts.winrate = new Chart(canvas, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          data: data,
          borderColor: '#00E5FF',
          backgroundColor: '#00E5FF22',
          fill: true,
          tension: 0.35,
          pointRadius: 3,
          pointHoverRadius: 5,
          pointBackgroundColor: '#00E5FF',
          pointBorderColor: '#00E5FF',
          borderWidth: 2
        }]
      },
      options: makeBaseOpts(function (chart, point) {
        var v = Number(point.parsed.y);
        if (isNaN(v)) return null;
        return {
          text: v.toFixed(1) + '%',
          color: v < 52 ? '#FF5D73' : '#32D583'
        };
      }),
      plugins: []
    });
    if (charts.winrate.options.plugins) {
      charts.winrate.options.plugins.sportsrsZeroLine = { enabled: false };
    }
  }

  function renderMonthlyChart() {
    var series = monthlySeriesCache;
    var labels = series.map(function (s) { return s.label; });
    if (!labels.length) {
      labels = ['—'];
      series = [{ roi: 0, profitUnits: 0 }];
    }
    var isRoi = monthlyMetric === 'roi';
    var data = series.map(function (s) {
      return Number((isRoi ? s.roi : s.profitUnits).toFixed(2));
    });
    var color = isRoi ? '#5B8CFF' : '#7C3AED';
    var canvas = qs('chart-monthly');
    if (!canvas) return;
    if (charts.monthly) charts.monthly.destroy();

    charts.monthly = new Chart(canvas, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          data: data,
          borderColor: color,
          backgroundColor: color + '22',
          fill: true,
          tension: 0.35,
          pointRadius: 3,
          pointHoverRadius: 5,
          pointBackgroundColor: color,
          pointBorderColor: color,
          borderWidth: 2
        }]
      },
      options: makeBaseOpts(function (chart, point) {
        var v = Number(point.parsed.y);
        if (isNaN(v)) return null;
        if (monthlyMetric === 'roi') {
          return { text: signedText(v, 2, '%'), color: signedColor(v) };
        }
        return { text: signedText(v, 2, ' Unit'), color: signedColor(v) };
      }),
      plugins: [zeroLinePlugin()]
    });
  }

  var cumulPanStart = 0;
  var cumulPanBound = false;

  function renderCumulativeChart() {
    var points = cumulPointsCache;
    var labels = points.map(function (p) { return p.label; });
    if (!labels.length) {
      labels = ['—'];
      points = [{ cumulRoi: 0, cumulUnits: 0, matchRoi: 0, matchUnits: 0, profit: 0, title: '—', date: '', league: '' }];
    }
    var isRoi = cumulMetric === 'roi';
    var data = points.map(function (p) {
      return Number((isRoi ? p.cumulRoi : p.cumulUnits).toFixed(2));
    });
    var color = isRoi ? '#00E5FF' : '#7C3AED';
    var canvas = qs('chart-cumulative');
    var panEl = qs('chart-cumulative-pan');
    if (!canvas) return;
    if (charts.cumulative) charts.cumulative.destroy();

    var WINDOW = 10;
    var n = Math.max(points.length, 1);
    // 預設看最新 10 筆
    cumulPanStart = Math.max(0, n - WINDOW);

    var opts = makeBaseOpts(function (chart, point) {
      var idx = point.dataIndex;
      var row = cumulPointsCache[idx];
      if (!row) return null;
      var lines = [
        row.title,
        (row.date || '') + (row.league ? ' · ' + row.league : ''),
        '該場 ' + signedText(row.matchRoi, 2, '%') + ' · ' + signedText(row.matchUnits, 2, ' Unit'),
        '累積 ' + (cumulMetric === 'roi'
          ? signedText(row.cumulRoi, 2, '%')
          : signedText(row.cumulUnits, 2, ' Unit'))
      ];
      return { text: lines.join('\n'), color: signedColor(row.matchRoi) };
    });
    opts.scales.x.ticks = { maxRotation: 0, autoSkip: false, maxTicksLimit: WINDOW };
    if (n > WINDOW) {
      opts.scales.x.min = cumulPanStart;
      opts.scales.x.max = cumulPanStart + WINDOW - 1;
    }

    charts.cumulative = new Chart(canvas, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          data: data,
          borderColor: color,
          backgroundColor: color + '18',
          fill: true,
          tension: 0.15,
          pointRadius: 3,
          pointHoverRadius: 5,
          pointBackgroundColor: color,
          pointBorderColor: color,
          borderWidth: 2
        }]
      },
      options: opts,
      plugins: [zeroLinePlugin()]
    });
    charts.cumulative.$sportsrsPoints = points;
    charts.cumulative.$sportsrsWindow = WINDOW;

    if (panEl && !cumulPanBound) {
      cumulPanBound = true;
      var dragging = false;
      var lastX = 0;
      var acc = 0;

      function applyPan() {
        var chart = charts.cumulative;
        if (!chart) return;
        var total = (cumulPointsCache && cumulPointsCache.length) || 0;
        var win = chart.$sportsrsWindow || 10;
        if (total <= win) {
          delete chart.options.scales.x.min;
          delete chart.options.scales.x.max;
        } else {
          cumulPanStart = Math.max(0, Math.min(total - win, cumulPanStart));
          chart.options.scales.x.min = cumulPanStart;
          chart.options.scales.x.max = cumulPanStart + win - 1;
        }
        chart.update('none');
      }

      panEl.addEventListener('pointerdown', function (e) {
        if (!charts.cumulative) return;
        dragging = true;
        lastX = e.clientX;
        acc = 0;
        panEl.classList.add('is-dragging');
        try { panEl.setPointerCapture(e.pointerId); } catch (err) {}
      });
      panEl.addEventListener('pointermove', function (e) {
        if (!dragging || !charts.cumulative) return;
        var dx = e.clientX - lastX;
        lastX = e.clientX;
        acc += dx;
        var stepPx = Math.max(18, (panEl.clientWidth || 240) / 10);
        var changed = false;
        // 往右拖／滑 → 看更早（圖往右移）；往左 → 看更新
        while (acc <= -stepPx) {
          acc += stepPx;
          cumulPanStart += 1;
          changed = true;
        }
        while (acc >= stepPx) {
          acc -= stepPx;
          cumulPanStart -= 1;
          changed = true;
        }
        if (changed) applyPan();
      });
      function endDrag(e) {
        if (!dragging) return;
        dragging = false;
        acc = 0;
        panEl.classList.remove('is-dragging');
        try { if (e && e.pointerId != null) panEl.releasePointerCapture(e.pointerId); } catch (err) {}
      }
      panEl.addEventListener('pointerup', endDrag);
      panEl.addEventListener('pointercancel', endDrag);
      panEl.addEventListener('lostpointercapture', function () {
        dragging = false;
        acc = 0;
        panEl.classList.remove('is-dragging');
      });
    }
  }

  function bindMetricToggle(containerId, getMetric, setMetric, redraw) {
    var box = qs(containerId);
    if (!box || box.dataset.bound === '1') return;
    box.dataset.bound = '1';
    box.addEventListener('click', function (e) {
      var btn = e.target.closest('.chart-toggle-btn');
      if (!btn) return;
      var metric = btn.getAttribute('data-metric');
      if (!metric || metric === getMetric()) return;
      setMetric(metric);
      box.querySelectorAll('.chart-toggle-btn').forEach(function (b) {
        b.classList.toggle('active', b.getAttribute('data-metric') === metric);
      });
      redraw();
    });
  }

  function rebuildChartDataAndRender() {
    monthlySeriesCache = buildMonthlySeries();
    cumulPointsCache = buildCumulativePoints();
    renderWinRateChart();
    renderMonthlyChart();
    renderCumulativeChart();
  }

  function leagueDisplayLabel(lg) {
    if (typeof LEAGUE_STATS_LABEL !== 'undefined' && LEAGUE_STATS_LABEL[lg]) {
      return String(LEAGUE_STATS_LABEL[lg]).replace(/^[^\w\u4e00-\u9fffA-Za-z0-9]+/, '').trim() || lg;
    }
    return lg;
  }

  function orderedLeagueKeys(map) {
    var keys = Object.keys(map);
    var preferred = [];
    if (typeof PRED_STATS_LEAGUE_ORDER !== 'undefined' && Array.isArray(PRED_STATS_LEAGUE_ORDER)) {
      preferred = PRED_STATS_LEAGUE_ORDER.slice();
    } else {
      preferred = ['SBL', 'TPBL', 'PLG', 'BCL', '英超', '西甲', '德甲', '法甲', '德乙', '美足', '墨超', '荷蘭甲', '歐冠', '歐洲超級盃', '聯賽盃'];
    }
    var ordered = preferred.filter(function (lg) { return map[lg]; });
    keys.sort().forEach(function (lg) {
      if (ordered.indexOf(lg) === -1) ordered.push(lg);
    });
    return ordered;
  }

  function buildLeagueCompareSeries(sportFilter) {
    var prev = chartSport;
    chartSport = sportFilter || 'all';
    var split = (typeof SEASON_SPLIT_DATE !== 'undefined') ? SEASON_SPLIT_DATE : '2026-07-17';
    var finals = filterByChartSport(getChartFinals()).filter(function (m) {
      return String(m.date || '') >= split;
    });
    chartSport = prev;

    var map = {};
    finals.forEach(function (m) {
      var lg = String(m.league || '').trim();
      if (!lg || lg === '__meta__') return;
      if (!map[lg]) map[lg] = { profit: 0, hit: 0, miss: 0, count: 0 };
      map[lg].profit += calcProfit(m);
      map[lg].count += 1;
      var hm = hitMissForMatch(m);
      map[lg].hit += hm.hit;
      map[lg].miss += hm.miss;
    });

    return orderedLeagueKeys(map).filter(function (lg) {
      var row = map[lg];
      return row && row.count > 0 && (row.hit + row.miss > 0 || Math.abs(row.profit) > 1e-9);
    }).map(function (lg) {
      var row = map[lg];
      var denom = row.hit + row.miss;
      var wr = denom > 0 ? (row.hit / denom) * 100 : 0;
      var units = UNIT > 0 ? row.profit / UNIT : 0;
      var roi = (units / BANKROLL) * 100;
      return {
        league: lg,
        label: leagueDisplayLabel(lg),
        count: row.count,
        winRate: wr,
        roi: roi,
        units: units
      };
    });
  }

  function barColorsForValues(values, mode) {
    return values.map(function (v) {
      if (mode === 'winrate') return Number(v) < 52 ? '#FF5D73' : '#32D583';
      if (v > 0) return '#32D583';
      if (v < 0) return '#FF5D73';
      return '#7C8AA5';
    });
  }

  function renderLeagueBarChart(canvasId, chartKey, metricKey, suffix, colorMode, zeroLine) {
    var series = leagueCompareCache;
    var labels = series.map(function (s) { return s.label; });
    var data = series.map(function (s) { return Number((s[metricKey] || 0).toFixed(2)); });
    if (!labels.length) {
      labels = ['—'];
      data = [0];
    }
    var canvas = qs(canvasId);
    if (!canvas) return;
    if (charts[chartKey]) charts[chartKey].destroy();

    var colors = barColorsForValues(data, colorMode);
    var opts = makeBaseOpts(function (chart, point) {
      var idx = point.dataIndex;
      var row = leagueCompareCache[idx];
      var v = Number(point.parsed.y);
      if (isNaN(v)) return null;
      var title = row ? (row.label + ' · ' + row.count + '場') : labels[idx];
      var text = title + '\n' + (suffix === '%'
        ? (metricKey === 'winRate' ? v.toFixed(1) + '%' : signedText(v, 2, '%'))
        : signedText(v, 2, ' Unit'));
      return { text: text, color: signedColor(metricKey === 'winRate' ? (v - 52) : v) };
    });
    opts.scales.x.ticks = {
      maxRotation: 45,
      minRotation: 0,
      autoSkip: false,
      font: { size: 10 }
    };
    opts.plugins.sportsrsZeroLine = { enabled: !!zeroLine };

    charts[chartKey] = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          data: data,
          backgroundColor: colors.map(function (c) { return c + 'CC'; }),
          borderColor: colors,
          borderWidth: 1,
          borderRadius: 4,
          maxBarThickness: 28
        }]
      },
      options: opts,
      plugins: zeroLine ? [zeroLinePlugin()] : []
    });
  }

  function renderLeagueCharts() {
    if (!window.Chart) {
      setTimeout(renderLeagueCharts, 200);
      return;
    }
    if (!qs('page-league-charts')) return;
    chartDefaults();
    leagueCompareCache = buildLeagueCompareSeries(leagueChartSport);
    renderLeagueBarChart('chart-league-winrate', 'leagueWr', 'winRate', '%', 'winrate', false);
    renderLeagueBarChart('chart-league-roi', 'leagueRoi', 'roi', '%', 'signed', true);
    renderLeagueBarChart('chart-league-units', 'leagueUnits', 'units', ' Unit', 'signed', true);
    bindLeagueChartsSportToggle();
  }

  function bindLeagueChartsSportToggle() {
    var box = qs('league-charts-sport-toggle');
    if (!box || leagueChartsSportBound) return;
    leagueChartsSportBound = true;
    box.addEventListener('click', function (e) {
      var btn = e.target.closest('.chart-toggle-btn');
      if (!btn) return;
      var sport = btn.getAttribute('data-sport');
      if (!sport || sport === leagueChartSport) return;
      leagueChartSport = sport;
      box.querySelectorAll('.chart-toggle-btn').forEach(function (b) {
        b.classList.toggle('active', b.getAttribute('data-sport') === sport);
      });
      renderLeagueCharts();
    });
  }

  function bindSportToggle() {
    var box = qs('charts-sport-toggle');
    if (!box || box.dataset.bound === '1') return;
    box.dataset.bound = '1';
    box.addEventListener('click', function (e) {
      var btn = e.target.closest('.chart-toggle-btn');
      if (!btn) return;
      var sport = btn.getAttribute('data-sport');
      if (!sport || sport === chartSport) return;
      chartSport = sport;
      box.querySelectorAll('.chart-toggle-btn').forEach(function (b) {
        b.classList.toggle('active', b.getAttribute('data-sport') === sport);
      });
      rebuildChartDataAndRender();
    });
  }

  function renderCharts() {
    if (!window.Chart) {
      setTimeout(renderCharts, 200);
      return;
    }
    chartDefaults();
    bindMetricToggle('monthly-metric-toggle', function () { return monthlyMetric; }, function (m) { monthlyMetric = m; }, renderMonthlyChart);
    bindMetricToggle('cumul-metric-toggle', function () { return cumulMetric; }, function (m) { cumulMetric = m; }, renderCumulativeChart);
    bindSportToggle();
    rebuildChartDataAndRender();
  }

  function refresh() {
    hideSkeleton();
    updateKpis();
    renderCharts();
    if (qs('page-league-charts') && qs('page-league-charts').classList.contains('active')) {
      renderLeagueCharts();
    }
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
    hideSkeleton: hideSkeleton,
    renderLeagueCharts: renderLeagueCharts
  };
})();
