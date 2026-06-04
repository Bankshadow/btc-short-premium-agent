import { getDeskRiskProfile } from "@/lib/desk/desk-risk-policy";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Lightweight desk status for external monitors (MVP 9). */
export async function GET() {
  return NextResponse.json({
    ok: true,
    desk: "btc-short-premium-agent",
    riskProfile: getDeskRiskProfile(),
    analysisOnly: true,
    integrations: {
      supabase: isSupabaseConfigured(),
      telegram: Boolean(
        process.env.TELEGRAM_BOT_TOKEN?.trim() &&
          process.env.TELEGRAM_CHAT_ID?.trim(),
      ),
      deskWebhook: Boolean(process.env.DESK_WEBHOOK_URL?.trim()),
      discord: Boolean(process.env.DISCORD_WEBHOOK_URL?.trim()),
      llmNarrator: Boolean(process.env.OPENAI_API_KEY?.trim()),
    },
    apis: {
      analyze: "POST /api/analyze",
      market: "GET /api/market",
      paperOrders: "GET /api/paper/orders?status=open",
      paperSync: "POST /api/paper/sync",
      journalSync: "GET|POST /api/journal/sync",
      deskHealth: "GET /api/desk/health",
      alertsTest: "POST /api/alerts/test",
      apiDocs: "/api-docs",
      tradingOs: "GET /api/trading-os",
    },
  });
}
