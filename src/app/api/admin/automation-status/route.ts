import {
  isCronSecretConfigured,
  isTestAutomationAllowed,
} from "@/lib/cron/cron-auth";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const telegramConfigured = Boolean(
    process.env.TELEGRAM_BOT_TOKEN?.trim() &&
      process.env.TELEGRAM_CHAT_ID?.trim(),
  );

  return NextResponse.json({
    testEnabled: isTestAutomationAllowed(),
    cronSecretConfigured: isCronSecretConfigured(),
    telegramConfigured,
  });
}
