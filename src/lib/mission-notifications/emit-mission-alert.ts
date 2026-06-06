import {
  dispatchExternalBriefing,
  sanitizeBriefingText,
} from "@/lib/smart-briefing/dispatch";
import {
  loadGoalNotificationPrefs,
  saveGoalNotificationPrefs,
} from "./goal-notification-store";

export type MissionAlertKind =
  | "cycle_complete"
  | "trade_verdict"
  | "blocker"
  | "trade_opened"
  | "trade_closed";

function isTelegramConfigured(): boolean {
  return Boolean(
    process.env.TELEGRAM_BOT_TOKEN?.trim() &&
      process.env.TELEGRAM_CHAT_ID?.trim(),
  );
}

function shouldSend(
  kind: MissionAlertKind,
  prefs: { notifyOnTrade: boolean; notifyOnBlocker: boolean },
): boolean {
  if (!isTelegramConfigured()) return false;
  if (kind === "blocker") return prefs.notifyOnBlocker;
  return prefs.notifyOnTrade;
}

export async function emitMissionAlert(input: {
  kind: MissionAlertKind;
  title: string;
  body: string;
}): Promise<{ sent: boolean; skipped?: string }> {
  const prefs = await loadGoalNotificationPrefs();
  if (!shouldSend(input.kind, prefs)) {
    return {
      sent: false,
      skipped: isTelegramConfigured()
        ? "disabled by notification preferences"
        : "Telegram not configured",
    };
  }

  const message = sanitizeBriefingText(
    `[Mission] ${input.title}\n${input.body}`.slice(0, 3900),
  );
  const channels = await dispatchExternalBriefing({ message });
  const sent = channels.telegram === true;
  if (sent) {
    await saveGoalNotificationPrefs({ lastAlertAt: new Date().toISOString() });
  }
  return {
    sent,
    skipped: sent ? undefined : String(channels.telegram ?? "dispatch failed"),
  };
}
