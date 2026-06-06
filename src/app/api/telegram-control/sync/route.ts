import { NextResponse } from "next/server";
import { syncTelegramControlChannel, TELEGRAM_CONTROL_SAFETY_NOTICE } from "@/lib/telegram-control-channel";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** MVP 77 — sync pinned status + permission prompt to Telegram. */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      sendPermissionPrompt?: boolean;
    };
    const result = await syncTelegramControlChannel({
      sendPermissionPrompt: body.sendPermissionPrompt !== false,
    });
    return NextResponse.json({
      mvp: 77,
      safetyNotice: TELEGRAM_CONTROL_SAFETY_NOTICE,
      ...result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Telegram sync failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
