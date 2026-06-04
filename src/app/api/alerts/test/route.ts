import { formatVerdictAlertBody } from "@/lib/alerts/verdict-templates";
import { sendDiscordWebhook } from "@/lib/alerts/discord";
import { isTestAutomationAllowed } from "@/lib/cron/cron-auth";
import { getMockDashboardFallback } from "@/lib/mock/dashboard-data";
import { sendTelegramMessage } from "@/lib/notify/telegram";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Send sample verdict alert (MVP 9 operator test). */
export async function POST(request: Request) {
  if (!isTestAutomationAllowed()) {
    return NextResponse.json({ ok: false, error: "Test mode disabled" }, { status: 403 });
  }

  let discordUrl = process.env.DISCORD_WEBHOOK_URL?.trim() ?? "";
  try {
    const body = (await request.json()) as { discordWebhookUrl?: string };
    if (body.discordWebhookUrl?.trim()) {
      discordUrl = body.discordWebhookUrl.trim();
    }
  } catch {
    // no body
  }

  const sample = getMockDashboardFallback();
  const message = formatVerdictAlertBody(sample, { includeBriefing: true });
  const result: Record<string, boolean | string> = { ok: true, messagePreview: message.slice(0, 120) };

  try {
    await sendTelegramMessage(`[MVP9 test]\n${message}`);
    result.telegramSent = true;
  } catch (err) {
    result.telegramError = err instanceof Error ? err.message : "Telegram failed";
  }

  if (discordUrl) {
    try {
      await sendDiscordWebhook(discordUrl, `[MVP9 test]\n${message}`);
      result.discordSent = true;
    } catch (err) {
      result.discordError = err instanceof Error ? err.message : "Discord failed";
    }
  }

  return NextResponse.json(result);
}
