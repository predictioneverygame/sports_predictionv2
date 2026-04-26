// RS 運彩獲利 Widget for Scriptable
// 使用方式：貼到 Scriptable 後，在下方 CONFIG 填入你的設定。

const CONFIG = {
  siteName: "RS運彩分析",
  supabaseUrl: "https://zcytivwjylkmnpqszvui.supabase.co",
  supabaseAnonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpjeXRpdndqeWxrbW5wcXN6dnVpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4NDU5NDksImV4cCI6MjA5MjQyMTk0OX0.NrBtPoDxlcmspY0MJ6-yIKYTznxxVocJ66vPNZy-JYA",
  matchesTable: "matches",
  profitStartDate: "2026-04-23",
  baseCapital: 162000,
  timeoutMs: 12000,
  // 建議改用本地照片最穩定：先在 Scriptable App 內執行一次，會讓你選圖
  preferLocalPhoto: true,
  // 要更換背景時改成 true，手動在 Scriptable 執行一次後再改回 false
  forcePickNewPhoto: false,
  // 若要刪掉已存本地圖，改成 true 執行一次後再改回 false
  resetLocalPhoto: false,
  backgroundImageFileName: "rs-widget-bg.jpg",
  backgroundImageUrls: [
    "https://upload.wikimedia.org/wikipedia/commons/7/76/LeBron_James_Lakers.jpg",
    "https://images.unsplash.com/photo-1546519638-68e109498ffc?auto=format&fit=crop&w=1200&q=80"
  ]
};

function roiClass(value) {
  if (value > 0) return "pos";
  if (value < 0) return "neg";
  return "zero";
}

function formatSignedPercent(value) {
  const fixed = Number(value || 0).toFixed(2);
  return `${value > 0 ? "+" : ""}${fixed}%`;
}

function formatSignedMoney(value) {
  const abs = Math.abs(value || 0).toFixed(0);
  if (value > 0) return `+$${abs}`;
  if (value < 0) return `-$${abs}`;
  return "$0";
}

async function fetchSettledMatches() {
  const selectFields = [
    "id",
    "date",
    "status",
    "sport",
    "odds",
    "stake",
    "profit",
    "prediction_result",
    "prediction_value",
    "home_score",
    "away_score"
  ].join(",");

  const url =
    `${CONFIG.supabaseUrl}/rest/v1/${CONFIG.matchesTable}` +
    `?select=${encodeURIComponent(selectFields)}` +
    `&status=eq.final` +
    `&date=gte.${CONFIG.profitStartDate}` +
    `&order=date.desc`;

  const req = new Request(url);
  req.method = "GET";
  req.timeoutInterval = Math.ceil(CONFIG.timeoutMs / 1000);
  req.headers = {
    apikey: CONFIG.supabaseAnonKey,
    Authorization: `Bearer ${CONFIG.supabaseAnonKey}`
  };

  const rows = await req.loadJSON();
  return Array.isArray(rows) ? rows : [];
}

function normalizeSoccerOverToken(token) {
  const text = String(token || "").trim().replace(/^O/i, "大").replace("大3.0", "大3");
  if (text === "全場大球") return "大3";
  return text;
}

function soccerOverUnderResultForToken(token, totalGoals) {
  const line = normalizeSoccerOverToken(token);
  if (line === "大2.75") {
    if (totalGoals >= 4) return "hit";
    if (totalGoals === 3) return "half_hit";
    return "miss";
  }
  if (line === "大3.25") {
    if (totalGoals >= 4) return "hit";
    if (totalGoals === 3) return "push";
    return "miss";
  }
  if (line === "大3.75") {
    if (totalGoals >= 5) return "hit";
    if (totalGoals === 4) return "half_hit";
    return "miss";
  }
  if (line === "大3" || line === "大3.0") {
    if (totalGoals > 3) return "hit";
    if (totalGoals === 3) return "push";
    return "miss";
  }
  const halfLine = line.match(/^大(\d+)\.5$/);
  if (halfLine) {
    const thr = parseFloat(`${halfLine[1]}.5`);
    return totalGoals > thr ? "hit" : "miss";
  }
  return null;
}

function combineSoccerDerivedResults(parts) {
  if (!parts.length) return null;
  if (parts.includes("miss")) return "miss";
  if (parts.includes("half_miss")) return "half_miss";
  if (parts.every((x) => x === "hit")) return "hit";
  if (parts.includes("half_hit")) return "half_hit";
  if (parts.includes("push")) return "push";
  return parts[0];
}

function basketballResultForSegment(segment, homeScore, awayScore) {
  const txt = String(segment || "").trim();
  const matched = txt.match(/^(主隊|客隊)\s*(PK|[+-]?\d+(?:\.\d+)?)$/);
  if (!matched) return null;

  const side = matched[1] === "客隊" ? "away" : "home";
  const line = matched[2];
  if (line === "PK") {
    if (side === "away") {
      if (awayScore > homeScore) return "hit";
      if (awayScore < homeScore) return "miss";
      return "push";
    }
    if (homeScore > awayScore) return "hit";
    if (homeScore < awayScore) return "miss";
    return "push";
  }

  const spread = parseFloat(line);
  if (Number.isNaN(spread)) return null;
  const adjusted = side === "away"
    ? awayScore + spread - homeScore
    : homeScore + spread - awayScore;
  if (adjusted > 0) return "hit";
  if (adjusted < 0) return "miss";
  return "push";
}

function derivePredictionDisplayResult(row, baseResult) {
  const status = String(row?.status || "");
  if (status !== "final") return baseResult;

  const raw = String(row?.prediction_value || "").trim();
  if (!raw) return baseResult;

  const sport = String(row?.sport || "").toLowerCase();
  const homeScore = Number(row?.home_score || 0);
  const awayScore = Number(row?.away_score || 0);

  if (sport === "soccer" || sport === "football") {
    const total = homeScore + awayScore;
    const parts = raw.split("/").map((s) => s.trim()).filter(Boolean);
    const derived = [];
    for (const one of parts) {
      const r = soccerOverUnderResultForToken(one, total);
      if (r === null) return baseResult;
      derived.push(r);
    }
    const combined = combineSoccerDerivedResults(derived);
    return combined !== null ? combined : baseResult;
  }

  if (sport === "basketball") {
    const parts = raw.split("/").map((s) => s.trim()).filter(Boolean);
    if (parts.length !== 1) return baseResult;
    const bbResult = basketballResultForSegment(parts[0], homeScore, awayScore);
    return bbResult !== null ? bbResult : baseResult;
  }

  return baseResult;
}

function calcProfitForMatch(row) {
  const stake = Number(row?.stake || 0);
  const odds = Number(row?.odds || 0);
  const hasOddsStake = stake > 0 && odds > 0;
  const baseResult = String(row?.prediction_result || "pending");
  const result = derivePredictionDisplayResult(row, baseResult);

  if (hasOddsStake) {
    if (result === "hit") return stake * odds - stake;
    if (result === "half_hit") return (stake * odds - stake) / 2;
    if (result === "miss") return -stake;
    if (result === "half_miss") return -(stake / 2);
    if (result === "push") return 0;
    return 0;
  }

  const profit = Number(row?.profit);
  if (!Number.isNaN(profit)) return profit;
  if (result === "hit") return stake * odds - stake;
  if (result === "half_hit") return (stake * odds - stake) / 2;
  if (result === "miss") return -stake;
  if (result === "half_miss") return -(stake / 2);
  if (result === "push") return 0;
  return 0;
}

function calcSummary(rows) {
  let totalProfit = 0;
  for (const row of rows) {
    totalProfit += calcProfitForMatch(row);
  }
  const roi = (totalProfit / CONFIG.baseCapital) * 100;
  return {
    settledCount: rows.length,
    totalProfit,
    roi
  };
}

async function applyWidgetBackground(widget) {
  const fm = FileManager.local();
  const docPath = fm.joinPath(fm.documentsDirectory(), CONFIG.backgroundImageFileName);
  const cachePath = fm.joinPath(fm.temporaryDirectory(), "rs-widget-bg-cache.jpg");

  if (CONFIG.resetLocalPhoto && fm.fileExists(docPath)) {
    fm.remove(docPath);
  }

  if (CONFIG.forcePickNewPhoto && !config.runsInWidget) {
    try {
      const picked = await Photos.fromLibrary();
      fm.writeImage(docPath, picked);
      widget.backgroundImage = picked;
      return;
    } catch (_) {
      // 使用者取消挑圖，繼續走原流程
    }
  }

  if (CONFIG.preferLocalPhoto && fm.fileExists(docPath)) {
    widget.backgroundImage = fm.readImage(docPath);
    return;
  }

  // 只有在 Scriptable App 內手動執行時可挑選照片；Widget 模式不能跳選圖
  if (CONFIG.preferLocalPhoto && !config.runsInWidget && !fm.fileExists(docPath)) {
    try {
      const picked = await Photos.fromLibrary();
      fm.writeImage(docPath, picked);
      widget.backgroundImage = picked;
      return;
    } catch (_) {
      // 使用者取消挑選就繼續往下走網路圖
    }
  }

  try {
    const urls = Array.isArray(CONFIG.backgroundImageUrls) ? CONFIG.backgroundImageUrls : [];
    for (const oneUrl of urls) {
      const req = new Request(oneUrl);
      req.timeoutInterval = Math.ceil(CONFIG.timeoutMs / 1000);
      const img = await req.loadImage();
      widget.backgroundImage = img;
      fm.writeImage(cachePath, img);
      return;
    }
  } catch (_) {
    if (fm.fileExists(cachePath)) {
      widget.backgroundImage = fm.readImage(cachePath);
      return;
    }
  }

  const grad = new LinearGradient();
  grad.colors = [new Color("#0f172a"), new Color("#1e293b")];
  grad.locations = [0, 1];
  widget.backgroundGradient = grad;
}

async function buildWidget(summary) {
  const w = new ListWidget();
  w.setPadding(6, 14, 14, 14);
  await applyWidgetBackground(w);

  const cls = roiClass(summary.roi);
  const roiColor =
    cls === "pos" ? new Color("#22c55e")
      : cls === "neg" ? new Color("#ef4444")
      : new Color("#f1f5f9");

  const title = w.addText(`${CONFIG.siteName} 獲利`);
  title.font = Font.semiboldSystemFont(12);
  title.textColor = new Color("#f8fafc");
  title.centerAlignText();

  w.addSpacer(0);

  const main = w.addText(formatSignedPercent(summary.roi));
  main.font = Font.boldSystemFont(30);
  main.textColor = roiColor;
  main.centerAlignText();

  w.addSpacer();

  return w;
}

function buildErrorWidget(message) {
  const w = new ListWidget();
  w.backgroundColor = new Color("#0f172a");
  w.setPadding(14, 14, 14, 14);

  const title = w.addText("RS獲利 Widget");
  title.font = Font.semiboldSystemFont(12);
  title.textColor = new Color("#f8fafc");

  w.addSpacer(6);
  const err = w.addText(message);
  err.font = Font.systemFont(12);
  err.textColor = new Color("#f87171");
  err.minimumScaleFactor = 0.7;

  return w;
}

async function main() {
  try {
    if (!CONFIG.supabaseUrl || !CONFIG.supabaseAnonKey || CONFIG.supabaseAnonKey === "YOUR_SUPABASE_ANON_KEY") {
      throw new Error("請先在 CONFIG 填入 Supabase 金鑰");
    }

    const rows = await fetchSettledMatches();
    const summary = calcSummary(rows);
    const widget = await buildWidget(summary);

    if (config.runsInWidget) {
      Script.setWidget(widget);
    } else {
      await widget.presentSmall();
    }
  } catch (err) {
    const widget = buildErrorWidget(String(err?.message || err));
    if (config.runsInWidget) {
      Script.setWidget(widget);
    } else {
      await widget.presentSmall();
    }
  }

  Script.complete();
}

await main();
