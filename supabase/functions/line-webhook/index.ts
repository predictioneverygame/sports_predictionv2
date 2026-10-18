// Supabase Edge Function：LINE Webhook → Flex 選單 + 聊天室列出推薦賽事
// Secrets：LINE_CHANNEL_SECRET、LINE_CHANNEL_ACCESS_TOKEN（或 ID+SECRET）
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SITE = "https://sportsrs.com";
const BRAND = "#0b5fad";
const BB_ACTIVE = "#ea580c";
const FB_ACTIVE = "#059669";
const TZ = "Asia/Taipei";

const BB_LEAGUES = ["SBL", "TPBL", "PLG", "BCL", "東超"] as const;
const FB_LEAGUES = ["英超", "西甲", "德甲", "法甲", "德乙", "美足", "荷蘭甲"] as const;
const OTHER_LEAGUE = "__other__";
const BB_LEAGUE_SET = new Set<string>(BB_LEAGUES);
const FB_LEAGUE_SET = new Set<string>(FB_LEAGUES);
const WEEKDAY = ["日", "一", "二", "三", "四", "五", "六"];

type RangeKey = "today" | "week";
type SportKey = "basketball" | "football";

type RecRow = {
  league?: string;
  home?: string;
  away?: string;
  line?: string;
  date?: string;
  time?: string;
  sport?: string;
  status?: string;
};

type MergedRec = {
  league: string;
  home: string;
  away: string;
  lines: string[];
  date: string;
  time: string;
  sport: string;
};

type LineEvent = {
  type: string;
  replyToken?: string;
  postback?: { data?: string };
  message?: { type?: string; text?: string };
};

async function getLineAccessToken(): Promise<string> {
  const preset = (Deno.env.get("LINE_CHANNEL_ACCESS_TOKEN") || "").trim();
  if (preset) return preset;

  const clientId = Deno.env.get("LINE_CHANNEL_ID") || "";
  const clientSecret = Deno.env.get("LINE_CHANNEL_SECRET") || "";
  if (!clientId || !clientSecret) {
    throw new Error("尚未設定 LINE token（LINE_CHANNEL_ACCESS_TOKEN 或 ID/SECRET）");
  }

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
  });
  const res = await fetch("https://api.line.me/oauth2/v2/accessToken", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) {
    throw new Error(String(data.error_description || data.error || "取得 LINE token 失敗"));
  }
  return String(data.access_token);
}

async function verifySignature(rawBody: string, signature: string | null): Promise<boolean> {
  const secret = (Deno.env.get("LINE_CHANNEL_SECRET") || "").trim();
  if (!secret || !signature) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  const bytes = new Uint8Array(mac);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary) === signature;
}

function parsePostbackData(raw: string): URLSearchParams {
  try {
    return new URLSearchParams(raw.trim());
  } catch {
    return new URLSearchParams();
  }
}

function taipeiDateKey(d = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d);
}

function addDaysYmd(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

function weekdayLabel(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return WEEKDAY[dt.getUTCDay()];
}

function rangeLabel(range: RangeKey) {
  return range === "today" ? "今日" : "本週";
}

function isWorldCupLeague(league: string) {
  return /世足\s*[A-L]組/.test(league) || /世足\s*(32強|16強|8強|4強|決賽|季軍|淘汰)/.test(league);
}

function resolveSport(league: string, sport?: string): string {
  if (BB_LEAGUE_SET.has(league)) return "basketball";
  if (sport === "soccer" || sport === "football") return "soccer";
  return "basketball";
}

function isSoccerSport(sport: string) {
  return sport === "soccer" || sport === "football";
}

function sportEmoji(sport: string) {
  if (sport === "basketball") return "🏀";
  if (isSoccerSport(sport)) return "⚽";
  return "📊";
}

function matchKey(item: RecRow) {
  return [
    resolveSport(String(item.league || ""), item.sport),
    String(item.league || "").trim(),
    String(item.home || "").trim(),
    String(item.away || "").trim(),
    String(item.date || "").trim(),
    String(item.time || "").trim(),
  ].join("\0");
}

function formatLineForLineMessage(line: string, home: string, away: string, sport: string) {
  if (sport !== "basketball") return line;
  return line
    .replace(/(^|[ /｜])主隊(?=\s|[+-]?\d|PK)/g, `$1${home}`)
    .replace(/(^|[ /｜])客隊(?=\s|[+-]?\d|PK)/g, `$1${away}`);
}

function mergeRecRows(items: RecRow[]): MergedRec[] {
  const merged: MergedRec[] = [];
  const indexByKey = new Map<string, number>();

  for (const item of items) {
    const league = String(item.league || "").trim();
    const home = String(item.home || "").trim();
    const away = String(item.away || "").trim();
    const date = String(item.date || "").trim();
    const time = String(item.time || "").trim();
    const sport = resolveSport(league, item.sport);
    const line = formatLineForLineMessage(String(item.line || "").trim(), home, away, sport);
    if (!league || !home || !away || !date || !time || !line) continue;
    if (isWorldCupLeague(league)) continue;

    const key = matchKey(item);
    const existingIdx = indexByKey.get(key);

    if (existingIdx === undefined) {
      indexByKey.set(key, merged.length);
      merged.push({ league, home, away, lines: [line], date, time, sport });
      continue;
    }
    const group = merged[existingIdx];
    if (!group.lines.includes(line)) group.lines.push(line);
  }

  return merged;
}

async function fetchRecommendations(): Promise<MergedRec[]> {
  const baseUrl = (Deno.env.get("SUPABASE_URL") || "").trim();
  const apiKey = (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY") || "").trim();
  if (!baseUrl || !apiKey) {
    throw new Error("Supabase 環境變數未設定");
  }

  const url = `${baseUrl}/rest/v1/recommendations?select=league,home,away,line,date,time,sport,status&order=date.asc,time.asc`;
  const res = await fetch(url, {
    headers: {
      apikey: apiKey,
      Authorization: `Bearer ${apiKey}`,
    },
  });
  if (!res.ok) {
    throw new Error(`讀取 recommendations 失敗 (${res.status})`);
  }
  const rows = await res.json() as RecRow[];
  return mergeRecRows(rows.filter((r) => String(r.status || "preview") !== "final"));
}

function filterPicks(
  items: MergedRec[],
  opts: { sport?: SportKey | "all"; range: RangeKey; league?: string | null },
) {
  let out = items.slice();

  if (opts.sport === "basketball") {
    out = out.filter((m) => m.sport === "basketball");
  } else if (opts.sport === "football") {
    out = out.filter((m) => isSoccerSport(m.sport));
  }

  if (opts.league === OTHER_LEAGUE) {
    if (opts.sport === "basketball") {
      out = out.filter((m) => !BB_LEAGUE_SET.has(m.league));
    } else if (opts.sport === "football") {
      out = out.filter((m) => !FB_LEAGUE_SET.has(m.league));
    }
  } else if (opts.league) {
    out = out.filter((m) => m.league === opts.league);
  }

  const todayKey = taipeiDateKey();
  if (opts.range === "today") {
    out = out.filter((m) => m.date === todayKey);
  } else {
    const endKey = addDaysYmd(todayKey, 7);
    out = out.filter((m) => m.date >= todayKey && m.date <= endKey);
  }

  out.sort((a, b) => {
    const dc = a.date.localeCompare(b.date);
    return dc !== 0 ? dc : a.time.localeCompare(b.time);
  });
  return out;
}

function formatDateHeader(date: string) {
  return `${date.slice(5).replace("-", "/")}（${weekdayLabel(date)}）`;
}

function formatMatchBlock(item: MergedRec, index: number, total: number) {
  const head = total > 1
    ? `【${index + 1}】${sportEmoji(item.sport)} ${item.league}`
    : `${sportEmoji(item.sport)} ${item.league}`;
  const matchup = item.time
    ? `${item.home} vs ${item.away} · ${item.time}`
    : `${item.home} vs ${item.away}`;
  const pick = item.lines.length ? `\n賽事預測：${item.lines.join("、")}` : "";
  return `${head}\n${matchup}${pick}`;
}

function buildPicksTitle(opts: { sport?: SportKey | "all"; range: RangeKey; league?: string | null }) {
  const parts: string[] = [rangeLabel(opts.range)];
  if (opts.sport === "basketball") parts.push("籃球");
  else if (opts.sport === "football") parts.push("足球");
  if (opts.league === OTHER_LEAGUE) parts.push("其他");
  else if (opts.league) parts.push(opts.league);
  return parts.join(" · ");
}

function buildPicksText(items: MergedRec[], opts: { sport?: SportKey | "all"; range: RangeKey; league?: string | null }) {
  const title = buildPicksTitle(opts);
  if (!items.length) {
    return `${title}\n\n這個條件下目前沒有待開賽推薦。`;
  }

  const byDate = new Map<string, MergedRec[]>();
  for (const item of items) {
    if (!byDate.has(item.date)) byDate.set(item.date, []);
    byDate.get(item.date)!.push(item);
  }

  const chunks: string[] = [`${title}（共 ${items.length} 場）`];
  for (const date of Array.from(byDate.keys()).sort()) {
    const dayItems = byDate.get(date)!;
    chunks.push(`\n${formatDateHeader(date)}`);
    dayItems.forEach((item, i) => {
      chunks.push(formatMatchBlock(item, i, dayItems.length));
    });
  }
  chunks.push(`\n👉 ${SITE}/picks`);
  return chunks.join("\n");
}

function splitTextMessages(text: string, maxLen = 4800): object[] {
  if (text.length <= maxLen) return [{ type: "text", text }];
  const messages: object[] = [];
  let rest = text;
  while (rest.length > maxLen) {
    let cut = rest.lastIndexOf("\n", maxLen);
    if (cut < maxLen * 0.5) cut = maxLen;
    messages.push({ type: "text", text: rest.slice(0, cut) });
    rest = rest.slice(cut).trimStart();
  }
  if (rest) messages.push({ type: "text", text: rest });
  return messages;
}

function flexFooterNote() {
  return {
    type: "box",
    layout: "vertical",
    paddingTop: "8px",
    contents: [{
      type: "text",
      text: "橘色／綠色＝目前有推薦 · 灰色＝目前無賽事",
      size: "xs",
      color: "#9ca3af",
      align: "center",
      wrap: true,
    }],
  };
}

function flexHeader(title: string, color = BRAND) {
  return {
    type: "box",
    layout: "vertical",
    backgroundColor: color,
    paddingAll: "18px",
    contents: [{
      type: "text",
      text: title,
      color: "#ffffff",
      weight: "bold",
      size: "lg",
    }],
  };
}

function postbackButton(
  label: string,
  data: string,
  opts?: { active?: boolean; color?: string },
) {
  const active = opts?.active !== false;
  const btn: Record<string, unknown> = {
    type: "button",
    style: active && opts?.color ? "primary" : "secondary",
    height: "sm",
    action: {
      type: "postback",
      label,
      data,
      displayText: label,
    },
  };
  if (active && opts?.color) btn.color = opts.color;
  return btn;
}

function buttonRows(items: object[], cols = 3) {
  const rows: object[] = [];
  for (let i = 0; i < items.length; i += cols) {
    const slice = items.slice(i, i + cols);
    while (slice.length < cols) slice.push({ type: "filler" });
    rows.push({
      type: "box",
      layout: "horizontal",
      spacing: "sm",
      contents: slice.map(function (btn) {
        return { type: "box", layout: "vertical", flex: 1, contents: [btn] };
      }),
    });
  }
  return rows;
}

function buildFlexBubble(title: string, headerColor: string, bodyRows: object[], altText: string) {
  return {
    type: "flex",
    altText,
    contents: {
      type: "bubble",
      size: "mega",
      header: flexHeader(title, headerColor),
      body: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        paddingAll: "16px",
        contents: bodyRows,
      },
      footer: flexFooterNote(),
    },
  };
}

function buildSportPickerFlex(range: RangeKey, all: MergedRec[]) {
  const label = rangeLabel(range);
  const r = range === "today" ? "t" : "w";
  const bbCount = filterPicks(all, { sport: "basketball", range }).length;
  const fbCount = filterPicks(all, { sport: "football", range }).length;
  const allCount = filterPicks(all, { sport: "all", range }).length;

  const buttons = [
    postbackButton("籃球", `s=b&r=${r}`, { active: bbCount > 0, color: BB_ACTIVE }),
    postbackButton("足球", `s=f&r=${r}`, { active: fbCount > 0, color: FB_ACTIVE }),
    postbackButton("全部", `p=a&r=${r}`, { active: allCount > 0, color: BRAND }),
  ];
  return buildFlexBubble(
    `${label}推薦 · 選擇項目`,
    BRAND,
    buttonRows(buttons, 3),
    `${label}推薦：請選擇籃球或足球`,
  );
}

function leaguePostback(sport: SportKey, range: RangeKey, league?: string) {
  const sc = sport === "basketball" ? "b" : "f";
  const rc = range === "today" ? "t" : "w";
  const params = new URLSearchParams({ p: sc, r: rc });
  if (league) params.set("l", league);
  return params.toString();
}

function buildLeaguePickerFlex(sport: SportKey, range: RangeKey, all: MergedRec[]) {
  const label = rangeLabel(range);
  const sportName = sport === "basketball" ? "籃球" : "足球";
  const headerColor = sport === "basketball" ? BB_ACTIVE : FB_ACTIVE;
  const activeColor = headerColor;
  const leagues = sport === "basketball" ? BB_LEAGUES : FB_LEAGUES;

  const leagueButtons = leagues.map((league) => {
    const count = filterPicks(all, { sport, range, league }).length;
    return postbackButton(league, leaguePostback(sport, range, league), {
      active: count > 0,
      color: activeColor,
    });
  });
  const otherCount = filterPicks(all, { sport, range, league: OTHER_LEAGUE }).length;
  leagueButtons.push(
    postbackButton("其他", leaguePostback(sport, range, OTHER_LEAGUE), {
      active: otherCount > 0,
      color: activeColor,
    }),
  );
  const allCount = filterPicks(all, { sport, range }).length;
  leagueButtons.push(
    postbackButton("全部" + sportName, leaguePostback(sport, range), {
      active: allCount > 0,
      color: activeColor,
    }),
  );

  const r = range === "today" ? "t" : "w";
  return buildFlexBubble(
    `${label}${sportName} · 選擇聯賽`,
    headerColor,
    [
      ...buttonRows(leagueButtons, 3),
      {
        type: "box",
        layout: "vertical",
        paddingTop: "12px",
        contents: [postbackButton("← 返回", `m=${r}`)],
      },
    ],
    `${label}${sportName}：請選擇聯賽`,
  );
}

async function buildPicksMessages(data: URLSearchParams): Promise<object[]> {
  const sportCode = data.get("p");
  const rangeCode = data.get("r");
  const league = data.get("l");

  const range: RangeKey | null = rangeCode === "t" ? "today" : rangeCode === "w" ? "week" : null;
  if (!range || !sportCode) {
    return [{ type: "text", text: "查詢條件不完整，請重新從選單開始。" }];
  }

  let sport: SportKey | "all" = "all";
  if (sportCode === "b") sport = "basketball";
  else if (sportCode === "f") sport = "football";
  else if (sportCode !== "a") {
    return [{ type: "text", text: "查詢條件不完整，請重新從選單開始。" }];
  }

  const all = await fetchRecommendations();
  const filtered = filterPicks(all, { sport, range, league });
  const text = buildPicksText(filtered, { sport, range, league });
  return splitTextMessages(text);
}

async function resolveMessages(data: URLSearchParams): Promise<object[]> {
  const menu = data.get("m");
  if (menu === "h") {
    return [{ type: "text", text: `SportsRS\n${SITE}\n\n輸入「今日」或「本週」查看推薦選單。` }];
  }

  if (data.get("p")) return buildPicksMessages(data);

  const sportCode = data.get("s");
  const rangeCode = data.get("r");
  const range: RangeKey | null = rangeCode === "t" ? "today" : rangeCode === "w" ? "week" : null;
  const sport: SportKey | null = sportCode === "b" ? "basketball" : sportCode === "f" ? "football" : null;

  const needsAvailability = menu === "t" || menu === "w" || (sport && range);
  if (!needsAvailability) {
    return [{ type: "text", text: "請點選下方圖文選單，或輸入「今日」「本週」查看推薦。" }];
  }

  const all = await fetchRecommendations();
  if (menu === "t") return [buildSportPickerFlex("today", all)];
  if (menu === "w") return [buildSportPickerFlex("week", all)];
  if (sport && range) return [buildLeaguePickerFlex(sport, range, all)];

  return [{ type: "text", text: "請點選下方圖文選單，或輸入「今日」「本週」查看推薦。" }];
}

async function lineReply(accessToken: string, replyToken: string, messages: object[]) {
  const res = await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ replyToken, messages: messages.slice(0, 5) }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    console.error("LINE reply failed", res.status, JSON.stringify(data));
    throw new Error(String(data.message || data.details || `LINE reply HTTP ${res.status}`));
  }
}

async function handleTextMessage(text: string): Promise<object[] | null> {
  const t = text.trim();
  const all = await fetchRecommendations();
  if (t === "今日" || t === "今日推薦") return [buildSportPickerFlex("today", all)];
  if (t === "本週" || t === "本週推薦") return [buildSportPickerFlex("week", all)];
  return null;
}

async function handleEvent(event: LineEvent, accessToken: string) {
  const replyToken = event.replyToken;
  if (!replyToken) return;

  let messages: object[] | null = null;

  if (event.type === "postback" && event.postback?.data) {
    messages = await resolveMessages(parsePostbackData(event.postback.data));
  } else if (event.type === "message" && event.message?.type === "text" && event.message.text) {
    messages = await handleTextMessage(event.message.text);
  }

  if (messages?.length) {
    await lineReply(accessToken, replyToken, messages);
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("ok", { status: 200 });
  }

  const rawBody = await req.text();
  const signature = req.headers.get("x-line-signature");

  if (!(await verifySignature(rawBody, signature))) {
    return new Response(JSON.stringify({ error: "invalid signature" }), { status: 401 });
  }

  try {
    const body = JSON.parse(rawBody);
    const events: LineEvent[] = Array.isArray(body.events) ? body.events : [];
    if (!events.length) {
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }

    const accessToken = await getLineAccessToken();
    for (const event of events) {
      await handleEvent(event, accessToken);
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
