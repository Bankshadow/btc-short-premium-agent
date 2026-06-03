import { loadCronAnalysisInput } from "@/lib/cron/cron-config";
import {
  isTestModeRequest,
  verifyCronOrTestAuthorization,
} from "@/lib/cron/cron-auth";
import { buildCronAnalyzeResponse } from "@/lib/cron/cron-response";
import { appendServerAnalysisFromResponse } from "@/lib/journal/journal-server-store";
import { runAnalyzeRequest } from "@/lib/decision/run-analyze";
import { BYBIT_API_FAILED_MESSAGE } from "@/lib/decision/bybit-health";
import { formatCronTelegramMessage } from "@/lib/notify/format-cron-telegram";
import { sendTelegramMessage } from "@/lib/notify/telegram";
import {
  isSupabaseConfigured,
  saveAnalysisRunToSupabase,
} from "@/lib/supabase/analysis-runs";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

async function handleCronAnalyze(request: Request) {
  const test = isTestModeRequest(request);
  const authError = verifyCronOrTestAuthorization(request, test);
  if (authError) return authError;

  try {
    const input = await loadCronAnalysisInput();
    const result = await runAnalyzeRequest(input);
    await appendServerAnalysisFromResponse(result);

    const response = buildCronAnalyzeResponse(result, { test });
    const warnings: string[] = [];

    if (isSupabaseConfigured()) {
      try {
        const saved = await saveAnalysisRunToSupabase(result);
        response.supabaseSaved = true;
        response.supabaseRunId = saved.id;
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Supabase journal save failed.";
        warnings.push(`Supabase journal save failed: ${message}`);
      }
    }

    try {
      await sendTelegramMessage(formatCronTelegramMessage(result));
      response.telegramSent = true;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Telegram notification failed.";
      warnings.push(`Telegram notification failed: ${message}`);
    }

    if (warnings.length > 0) {
      response.warnings = warnings;
    }

    return NextResponse.json(response);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Cron analysis failed";
    const isBybit =
      message.toLowerCase().includes("bybit") ||
      message.includes("BTCUSDT ticker");

    return NextResponse.json(
      { error: isBybit ? BYBIT_API_FAILED_MESSAGE : message, test },
      { status: 500 },
    );
  }
}

/** Vercel Cron and manual triggers (GET). Use ?test=1 for dashboard test mode. */
export async function GET(request: Request) {
  return handleCronAnalyze(request);
}

/** Optional POST. Use ?test=1 or header X-Test-Mode: true for dashboard test. */
export async function POST(request: Request) {
  return handleCronAnalyze(request);
}
