import { NextResponse } from "next/server";
import {
  loadGoalNotificationPrefs,
  saveGoalNotificationPrefs,
} from "@/lib/mission-notifications/goal-notification-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const prefs = await loadGoalNotificationPrefs();
    const telegramConfigured = Boolean(
      process.env.TELEGRAM_BOT_TOKEN?.trim() &&
        process.env.TELEGRAM_CHAT_ID?.trim(),
    );
    return NextResponse.json({ ok: true, prefs, telegramConfigured });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load notification settings";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      notifyOnTrade?: boolean;
      notifyOnBlocker?: boolean;
    };
    const prefs = await saveGoalNotificationPrefs({
      notifyOnTrade: body.notifyOnTrade,
      notifyOnBlocker: body.notifyOnBlocker,
    });
    const telegramConfigured = Boolean(
      process.env.TELEGRAM_BOT_TOKEN?.trim() &&
        process.env.TELEGRAM_CHAT_ID?.trim(),
    );
    return NextResponse.json({ ok: true, prefs, telegramConfigured });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to save notification settings";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
