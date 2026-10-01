/**
 * SportsRS client-side URL router (History API).
 * Init MUST run after Supabase data load + SportsRSUI.refresh().
 */
(function () {
  'use strict';

  var LEAGUE_SLUGS = {
    SBL: 'sbl',
    TPBL: 'tpbl',
    PLG: 'plg',
    BCL: 'bcl',
    '英超': 'premier-league',
    '西甲': 'la-liga',
    '德甲': 'bundesliga',
    '法甲': 'ligue-1',
    '德乙': 'bundesliga-2',
    '美足': 'mls',
    '墨超': 'liga-mx',
    '荷蘭甲': 'eredivisie',
    '歐冠': 'champions-league',
    '歐洲超級盃': 'uefa-super-cup',
    '聯賽盃': 'leagues-cup'
  };

  var SLUG_TO_LEAGUE = {};
  Object.keys(LEAGUE_SLUGS).forEach(function (name) {
    SLUG_TO_LEAGUE[LEAGUE_SLUGS[name]] = name;
  });

  var BB_LEAGUES = { SBL: 1, TPBL: 1, PLG: 1, BCL: 1 };

  var PAGE_TITLES = {
    home: 'SportsRS — Professional Sports Analytics',
    picks: 'SportsRS — 每日推薦',
    leagues: 'SportsRS — 聯賽分類',
    records: 'SportsRS — 歷史戰績',
    basketball: 'SportsRS — Basketball Picks & Analytics',
    football: 'SportsRS — Football Picks & Analytics',
    performance: 'SportsRS — 各聯賽績效',
    about: 'SportsRS — 關於',
    worldcup: 'SportsRS — 2026 世界盃',
    match: 'SportsRS — Match Analysis'
  };

  var applying = false;
  var ready = false;
  var pendingRoute = null;

  function leagueSport(league) {
    return BB_LEAGUES[league] ? 'basketball' : 'football';
  }

  function leagueToPath(league) {
    var slug = LEAGUE_SLUGS[league];
    if (!slug) return '/';
    return '/' + leagueSport(league) + '/' + slug;
  }

  function pageNameToPath(name) {
    var map = {
      home: '/',
      about: '/about',
      'league-charts': '/performance',
      worldcup: '/worldcup',
      basketball: '/basketball',
      football: '/football'
    };
    return map[name] || '/';
  }

  function parseQuery(search) {
    var q = {};
    var s = search || window.location.search;
    if (!s || s.length < 2) return q;
    s.slice(1).split('&').forEach(function (pair) {
      var i = pair.indexOf('=');
      if (i === -1) q[decodeURIComponent(pair)] = '';
      else q[decodeURIComponent(pair.slice(0, i))] = decodeURIComponent(pair.slice(i + 1));
    });
    return q;
  }

  function parsePath(pathname, search) {
    var parts = String(pathname || '/').replace(/\/+$/, '').split('/').filter(Boolean);
    var query = parseQuery(search);

    if (parts.length === 0) return { type: 'home', query: query };
    if (parts[0] === 'picks') return { type: 'picks', query: query };
    if (parts[0] === 'leagues') return { type: 'leagues', query: query };
    if (parts[0] === 'records') return { type: 'records', query: query };
    if (parts[0] === 'about') return { type: 'about', query: query };
    if (parts[0] === 'performance') return { type: 'performance', query: query };
    if (parts[0] === 'worldcup') return { type: 'worldcup', query: query };

    if (parts[0] === 'match' && parts[1]) {
      return { type: 'match', matchId: decodeURIComponent(parts[1]), query: query };
    }

    if (parts[0] === 'basketball') {
      if (parts[1] && SLUG_TO_LEAGUE[parts[1]]) {
        return { type: 'league', league: SLUG_TO_LEAGUE[parts[1]], query: query };
      }
      return { type: 'sport', sport: 'basketball', query: query };
    }

    if (parts[0] === 'football') {
      if (parts[1] && SLUG_TO_LEAGUE[parts[1]]) {
        return { type: 'league', league: SLUG_TO_LEAGUE[parts[1]], query: query };
      }
      return { type: 'sport', sport: 'football', query: query };
    }

    return { type: 'home', query: query };
  }

  function buildPath(route) {
    if (!route) return '/';
    switch (route.type) {
      case 'home': return '/';
      case 'picks': return '/picks';
      case 'leagues': return '/leagues';
      case 'records': return '/records';
      case 'about': return '/about';
      case 'performance': return '/performance';
      case 'worldcup': return '/worldcup';
      case 'sport':
        return route.sport === 'basketball' ? '/basketball' : '/football';
      case 'league':
        return leagueToPath(route.league);
      case 'match':
        return '/match/' + encodeURIComponent(route.matchId || '');
      default:
        return '/';
    }
  }

  function setTitle(route) {
    var title = PAGE_TITLES.home;
    if (!route) {
      document.title = title;
      return;
    }
    if (route.type === 'sport') {
      title = route.sport === 'basketball' ? PAGE_TITLES.basketball : PAGE_TITLES.football;
    } else if (route.type === 'league') {
      title = 'SportsRS — ' + (route.league || 'League') + ' Betting Analytics';
    } else if (route.type === 'match') {
      title = PAGE_TITLES.match;
    } else {
      title = PAGE_TITLES[route.type] || PAGE_TITLES.home;
    }
    document.title = title;
    var ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) ogTitle.setAttribute('content', title);
    var ogUrl = document.querySelector('meta[property="og:url"]');
    if (ogUrl) ogUrl.setAttribute('content', 'https://sportsrs.com' + buildPath(route));
  }

  var NAV_ROUTE_TYPES = {
    '/': ['home', 'match', 'worldcup'],
    '/picks': ['picks'],
    '/performance': ['performance'],
    '/leagues': ['leagues', 'league', 'sport'],
    '/about': ['about']
  };

  function updateNavActive(route) {
    var type = route ? route.type : 'home';
    document.querySelectorAll('.nav-links a[data-route]').forEach(function (a) {
      var types = NAV_ROUTE_TYPES[a.getAttribute('data-route') || '/'] || [];
      a.classList.toggle('active', types.indexOf(type) !== -1);
    });
  }

  function scrollToId(id, delay) {
    if (!id) return;
    setTimeout(function () {
      var el = document.getElementById(id);
      if (!el) return;
      var y = el.getBoundingClientRect().top + window.scrollY - 80;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }, delay != null ? delay : 50);
  }

  function setHomeChartSport(sportKey) {
    if (!window.SportsRSUI || typeof window.SportsRSUI.setChartSport !== 'function') return;
    var map = { basketball: 'basketball', football: 'soccer', all: 'all' };
    window.SportsRSUI.setChartSport(map[sportKey] || 'all', { safe: true });
  }

  function setPerformanceChartSport(query) {
    if (!query || !query.sport) return;
    if (!window.SportsRSUI || typeof window.SportsRSUI.setLeagueChartSport !== 'function') return;
    var map = { basketball: 'basketball', football: 'soccer', soccer: 'soccer' };
    window.SportsRSUI.setLeagueChartSport(map[query.sport] || query.sport, { safe: true });
  }

  function applyRoute(route) {
    if (!route) route = parsePath(window.location.pathname, window.location.search);
    pendingRoute = route;
    if (!ready) return;

    applying = true;
    try {
      setTitle(route);
      updateNavActive(route);

      switch (route.type) {
        case 'home':
          if (typeof window._applyPage === 'function') window._applyPage('home');
          setHomeChartSport('all');
          window.scrollTo(0, 0);
          break;

        case 'picks':
          if (typeof window._applyPage === 'function') window._applyPage('home');
          setHomeChartSport('all');
          scrollToId('daily-recs-title', 80);
          break;

        case 'leagues':
          if (typeof window._applyPage === 'function') window._applyPage('home');
          setHomeChartSport('all');
          scrollToId('leagues', 80);
          break;

        case 'records':
          if (typeof window._applyPage === 'function') window._applyPage('home');
          setHomeChartSport('all');
          scrollToId('recent-records', 80);
          break;

        case 'sport':
          if (typeof window._applyPage === 'function') window._applyPage('home');
          setHomeChartSport(route.sport);
          scrollToId(route.sport === 'basketball' ? 'section-basketball' : 'section-football', 80);
          break;

        case 'league':
          if (typeof window.showLeague === 'function') window.showLeague(route.league, { fromRouter: true });
          break;

        case 'match':
          if (typeof window.showMatch === 'function') window.showMatch(route.matchId, { fromRouter: true });
          break;

        case 'performance':
          if (typeof window._applyPage === 'function') window._applyPage('league-charts');
          setPerformanceChartSport(route.query);
          break;

        case 'about':
          if (typeof window._applyPage === 'function') window._applyPage('about');
          break;

        case 'worldcup':
          if (typeof window._applyPage === 'function') window._applyPage('worldcup');
          break;

        default:
          if (typeof window._applyPage === 'function') window._applyPage('home');
          window.scrollTo(0, 0);
      }
    } finally {
      applying = false;
    }
  }

  function navigate(path, opts) {
    opts = opts || {};
    var qIndex = path.indexOf('?');
    var pathname = qIndex >= 0 ? path.slice(0, qIndex) : path;
    var search = qIndex >= 0 ? path.slice(qIndex) : '';
    if (opts.replace) {
      history.replaceState({ path: path }, '', path);
    } else {
      history.pushState({ path: path }, '', path);
    }
    if (!opts.skipApply) applyRoute(parsePath(pathname, search));
    else {
      setTitle(parsePath(pathname, search));
      updateNavActive(parsePath(pathname, search));
    }
  }

  function bindLinkInterceptor() {
    document.addEventListener('click', function (e) {
      var a = e.target.closest('a[href^="/"]');
      if (!a || a.getAttribute('target') === '_blank') return;
      if (a.hasAttribute('download')) return;
      var href = a.getAttribute('href');
      if (!href || href.charAt(0) !== '/') return;
      e.preventDefault();
      navigate(href);
    });
  }

  function bindMatchCardNavigation() {
    document.addEventListener('click', function (e) {
      if (applying || !ready) return;
      var card = e.target.closest('.match-card[data-match-id], .records-row[data-match-id]');
      if (!card) return;
      if (e.target.closest('a, button, input, select, textarea')) return;
      var id = card.getAttribute('data-match-id');
      if (!id) return;
      navigate('/match/' + encodeURIComponent(id));
    });
  }

  function init() {
    if (ready) {
      applyRoute(parsePath(window.location.pathname, window.location.search));
      return;
    }
    bindLinkInterceptor();
    bindMatchCardNavigation();
    window.addEventListener('popstate', function () {
      applyRoute(parsePath(window.location.pathname, window.location.search));
    });
    ready = true;
    var path = window.location.pathname + window.location.search;
    history.replaceState({ path: path }, '', path);
    applyRoute(parsePath(window.location.pathname, window.location.search));
  }

  window.SportsRSRouter = {
    init: init,
    navigate: navigate,
    applyRoute: applyRoute,
    parsePath: parsePath,
    buildPath: buildPath,
    leagueToPath: leagueToPath,
    pageNameToPath: pageNameToPath,
    isApplying: function () { return applying; },
    LEAGUE_SLUGS: LEAGUE_SLUGS
  };
})();
