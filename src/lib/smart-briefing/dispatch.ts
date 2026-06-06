import { sendDiscordWebhook } from "@/lib/alerts/discord";
import { sendTelegramMessage } from "@/lib/notify/telegram";
import { loadDeskSettings } from "@/lib/desk/desk-settings";
import { formatSmartBriefingMessage } from "./format-message";
import type { SmartBriefingPayload } from "./types";

const SECRET_PATTERNS = [
  /TELEGRAM_BOT_TOKEN/i,
  /TELEGRAM_CHAT_ID/i,
  /DISCORD_WEBHOOK/i,
  /DESK_WEBHOOK/i,
  /CRON_SECRET/i,
  /API[_-]?KEY/i,
  /SECRET/i,
  /Bearer\s+[A-Za-z0-9._-]+/i,
];

export function sanitizeBriefingText(text: string): string {
  let safe = text.slice(0, 3900);
  safe = safe.replace(
    /(TELEGRAM_BOT_TOKEN|TELEGRAM_CHAT_ID|DISCORD_WEBHOOK|DESK_WEBHOOK|CRON_SECRET|API[_-]?KEY)\s*[=:]\s*\S+/gi,
    "[redacted]",
  );
  for (const pattern of SECRET_PATTERNS) {
    safe = safe.replace(pattern, "[redacted]");
  }
  safe = safe.replace(
    /(token|secret|key|password|bearer)\s*[=:]\s*\S+/gi,
    "[redacted]",
  );
  return safe;
}

export interface ExternalDispatchInput {
  message: string;
  discordWebhookUrl?: string;
  deskWebhookUrl?: string;
}

export async function dispatchExternalBriefing(
  input: ExternalDispatchInput,
): Promise<Record<string, boolean | string>> {
  const results: Record<string, boolean | string> = {};
  const message = sanitizeBriefingText(input.message);

  try {
    await sendTelegramMessage(message);
    results.telegram = true;
  } catch (err) {
    results.telegram =
      err instanceof Error ? err.message : "Telegram dispatch failed";
  }

  const discordUrl =
    input.discordWebhookUrl?.trim() ||
    process.env.DISCORD_WEBHOOK_URL?.trim() ||
    "";
  if (discordUrl) {
    try {
      await sendDiscordWebhook(discordUrl, message);
      results.discord = true;
    } catch (err) {
      results.discord =
        err instanceof Error ? err.message : "Discord dispatch failed";
    }
  }

  const webhookUrl =
    input.deskWebhookUrl?.trim() || process.env.DESK_WEBHOOK_URL?.trim() || "";
  if (webhookUrl) {
    try {
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "desk.smart_briefing",
          message: message.slice(0, 1900),
          timestamp: new Date().toISOString(),
        }),
      });
      results.webhook = response.ok;
      if (!response.ok) {
        results.webhook = `HTTP ${response.status}`;
      }
    } catch (err) {
      results.webhook =
        err instanceof Error ? err.message : "Webhook dispatch failed";
    }
  }

  return results;
}

export async function dispatchBriefingFromClient(
  payload: SmartBriefingPayload,
): Promise<Record<string, boolean | string>> {
  const desk = loadDeskSettings();
  const message = formatSmartBriefingMessage(payload);
  try {
    const res = await fetch("/api/smart-briefing/dispatch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        discordWebhookUrl: desk.discordWebhookUrl || undefined,
      }),
    });
    const data = (await res.json()) as {
      ok: boolean;
      channelResults?: Record<string, boolean | string>;
    };
    return data.channelResults ?? {};
  } catch (err) {
    return {
      api: err instanceof Error ? err.message : "Dispatch API failed",
    };
  }
}
