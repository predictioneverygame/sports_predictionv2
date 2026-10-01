// Supabase Edge Function：新增推薦後推播 LINE 官方帳號追蹤者（Broadcast）
// Secrets（Dashboard → Edge Functions → Secrets）：
//   LINE_CHANNEL_ID、LINE_CHANNEL_SECRET、LINE_NOTIFY_SECRET
//   可選 LINE_CHANNEL_ACCESS_TOKEN（Messaging API 頁面核發的長效 Token，較穩定）
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SITE_URL = "https://sportsrs.com/";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type RecItem = {
  league?: string;
  home?: string;
  away?: string;
  line?: string;
  date?: string;
  time?: string;
  sport?: string;
};

type MergedRecItem = {
  league?: string;
  home?: string;
  away?: string;
  lines: string[];
  date?: string;
  time?: string;
  sport?: string;
};

function matchKey(item: RecItem) {
  return [
    String(item.sport || "").toLowerCase(),
    String(item.league || "").trim(),
    String(item.home || "").trim(),
    String(item.away || "").trim(),
    String(item.date || "").trim(),
    String(item.time || "").trim(),
  ].join("\0");
}

/** 同一場（聯賽、對手、日期時間相同）的多個盤口合併為一則 */
function mergeRecItems(items: RecItem[]): MergedRecItem[] {
  const merged: MergedRecItem[] = [];
  const indexByKey = new Map<string, number>();

  for (const item of items) {
    const key = matchKey(item);
    const line = String(item.line || "").trim();
    const existingIdx = indexByKey.get(key);

    if (existingIdx === undefined) {
      indexByKey.set(key, merged.length);
      merged.push({
        league: item.league,
        home: item.home,
        away: item.away,
        lines: line ? [line] : [],
        date: item.date,
        time: item.time,
        sport: item.sport,
      });
      continue;
    }

    const group = merged[existingIdx];
    if (line && !group.lines.includes(line)) {
      group.lines.push(line);
    }
  }

  return merged;
}

async function getLineAccessToken(): Promise<string> {
  const preset = (Deno.env.get("LINE_CHANNEL_ACCESS_TOKEN") || "").trim();
  if (preset) return preset;

  const clientId = Deno.env.get("LINE_CHANNEL_ID") || "";
  const clientSecret = Deno.env.get("LINE_CHANNEL_SECRET") || "";
  if (!clientId || !clientSecret) {
    throw new Error("伺服器尚未設定 LINE_CHANNEL_ID / LINE_CHANNEL_SECRET（或 LINE_CHANNEL_ACCESS_TOKEN）");
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

async function verifyLineBot(accessToken: string) {
  const res = await fetch("https://api.line.me/v2/bot/info", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const hint = res.status === 404
      ? "找不到 Bot：請確認這是 Messaging API Channel，且已在 LINE Official Account Manager 啟用並連結 Messaging API。"
      : "";
    throw new Error(`LINE Bot 驗證失敗 (${res.status})：${String(data.message || data.details || "unknown")}${hint ? " " + hint : ""}`);
  }
  return data;
}

function sportEmoji(sport?: string) {
  const s = String(sport || "").toLowerCase();
  if (s === "basketball") return "🏀";
  if (s === "soccer" || s === "football") return "⚽";
  return "📊";
}

function formatRecBlock(item: MergedRecItem, index: number, total: number) {
  const league = String(item.league || "賽事").trim();
  const home = String(item.home || "").trim();
  const away = String(item.away || "").trim();
  const date = String(item.date || "").trim();
  const time = String(item.time || "").trim();
  const head = total > 1 ? `\n【${index + 1}】${sportEmoji(item.sport)} ${league}` : `${sportEmoji(item.sport)} ${league}`;
  const matchup = home && away ? `\n${home} vs ${away}` : "";
  const pick = item.lines.length
    ? `\n初盤：${item.lines.join("、")}`
    : "";
  const when = date ? `\n📅 ${date.slice(5).replace("-", "/")}${time ? " " + time : ""}` : "";
  return head + matchup + pick + when;
}

function buildBroadcastText(items: RecItem[]) {
  const merged = mergeRecItems(items);
  const blocks = merged.map(function (item, i) {
    return formatRecBlock(item, i, merged.length);
  }).join("\n");
  return (
    "新賽事推薦\n" +
    blocks +
    "\n\n👉 查看詳情\n" +
    SITE_URL
  );
}

async function lineBroadcast(accessToken: string, text: string) {
  const res = await fetch("https://api.line.me/v2/bot/message/broadcast", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messages: [{ type: "text", text: text.slice(0, 5000) }],
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = String(data.message || data.details || `LINE HTTP ${res.status}`);
    const hint = res.status === 404
      ? "（常見原因：官方帳號尚未啟用 Messaging API，或 Channel 未正確連結到 @013dnjqw）"
      : res.status === 403
        ? "（常見原因：Broadcast 權限未開通或訊息額度不足）"
        : "";
    throw new Error(`${msg}${hint}`);
  }
  return data;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const expectedSecret = Deno.env.get("LINE_NOTIFY_SECRET") || "";
    if (!expectedSecret) {
      return new Response(JSON.stringify({ error: "伺服器尚未設定 LINE_NOTIFY_SECRET" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    if (String(body.notifySecret || "") !== expectedSecret) {
      return new Response(JSON.stringify({ error: "未授權" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const items = Array.isArray(body.items) ? body.items : [];
    if (!items.length) {
      return new Response(JSON.stringify({ error: "需要 items" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = await getLineAccessToken();
    await verifyLineBot(token);
    const merged = mergeRecItems(items);
    const text = buildBroadcastText(items);
    await lineBroadcast(token, text);

    return new Response(JSON.stringify({ ok: true, count: merged.length, items: items.length }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err && err.message ? err.message : err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
