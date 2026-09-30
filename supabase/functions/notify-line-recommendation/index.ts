// Supabase Edge Function：新增推薦後推播 LINE 官方帳號追蹤者（Broadcast）
// Secrets（Dashboard → Edge Functions → Secrets）：
//   LINE_CHANNEL_ID、LINE_CHANNEL_SECRET、LINE_NOTIFY_SECRET
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

async function getLineAccessToken(): Promise<string> {
  const clientId = Deno.env.get("LINE_CHANNEL_ID") || "";
  const clientSecret = Deno.env.get("LINE_CHANNEL_SECRET") || "";
  if (!clientId || !clientSecret) {
    throw new Error("伺服器尚未設定 LINE_CHANNEL_ID / LINE_CHANNEL_SECRET");
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

function sportEmoji(sport?: string) {
  const s = String(sport || "").toLowerCase();
  if (s === "basketball") return "🏀";
  if (s === "soccer" || s === "football") return "⚽";
  return "📊";
}

function formatRecBlock(item: RecItem, index: number, total: number) {
  const league = String(item.league || "賽事").trim();
  const home = String(item.home || "").trim();
  const away = String(item.away || "").trim();
  const line = String(item.line || "").trim();
  const date = String(item.date || "").trim();
  const time = String(item.time || "").trim();
  const head = total > 1 ? `\n【${index + 1}】${sportEmoji(item.sport)} ${league}` : `${sportEmoji(item.sport)} ${league}`;
  const matchup = home && away ? `\n${home} vs ${away}` : "";
  const pick = line ? `\n初盤：${line}` : "";
  const when = date ? `\n📅 ${date.slice(5).replace("-", "/")}${time ? " " + time : ""}` : "";
  return head + matchup + pick + when;
}

function buildBroadcastText(items: RecItem[]) {
  const blocks = items.map(function (item, i) {
    return formatRecBlock(item, i, items.length);
  }).join("\n");
  return (
    "SportsRS 新推薦" +
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
    throw new Error(String(data.message || data.details || `LINE HTTP ${res.status}`));
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
    const text = buildBroadcastText(items);
    await lineBroadcast(token, text);

    return new Response(JSON.stringify({ ok: true, count: items.length }), {
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
