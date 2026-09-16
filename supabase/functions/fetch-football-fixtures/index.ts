// Supabase Edge Function：代打 API-Football，Key 存在 Secrets，不上 GitHub
// 部署後設定：supabase secrets set APISPORTS_KEY=你的key
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const APISPORTS_BASE = "https://v3.football.api-sports.io";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("APISPORTS_KEY") || "";
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "伺服器尚未設定 APISPORTS_KEY" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const date = String(body.date || "");
    const league = Number(body.league || 0);
    const season = Number(body.season || 0);

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !league || !season) {
      return new Response(JSON.stringify({ error: "需要 date / league / season" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = `${APISPORTS_BASE}/fixtures?date=${encodeURIComponent(date)}&league=${league}&season=${season}`;
    const upstream = await fetch(url, {
      headers: { "x-apisports-key": apiKey },
    });
    const text = await upstream.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }

    return new Response(JSON.stringify(data), {
      status: upstream.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err && err.message ? err.message : err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
