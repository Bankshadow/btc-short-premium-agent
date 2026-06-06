import { NextResponse } from "next/server";
import {
  TELEGRAM_CONTROL_SAFETY_NOTICE,
  isTelegramControlEnabled,
  loadTelegramControlState,
  TELEGRAM_COMMANDS,
  getTelegramWebhookSecret,
} from "@/lib/telegram-control-channel";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** MVP 77 — Telegram control channel status for dashboard. */
export async function GET(request: Request) {
  try {
    const state = await loadTelegramControlState();
    const origin = new URL(request.url).origin;
    const secret = getTelegramWebhookSecret();
    const webhookPath = secret
      ? `/api/telegram/webhook?secret=${encodeURIComponent(secret)}`
      : "/api/telegram/webhook";

    return NextResponse.json({
      ok: true,
      mvp: 77,
      enabled: isTelegramControlEnabled(),
      safetyNotice: TELEGRAM_CONTROL_SAFETY_NOTICE,
      state,
      commands: TELEGRAM_COMMANDS,
      webhookUrl: `${origin}${webhookPath}`,
      cannotEnableLive: true,
      approvalExpiresMinutes: 5,
      doubleConfirmViaApprove: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Telegram control status failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
