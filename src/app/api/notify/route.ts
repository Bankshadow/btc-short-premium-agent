import { runAnalysisEngine } from "@/lib/decision/analyze";
import type { AnalysisInput } from "@/lib/types/market";
import {
  sendTelegramMessage,
  TelegramApiError,
  TelegramConfigError,
} from "@/lib/telegram/client";
import { formatAnalysisNotification } from "@/lib/telegram/format-analysis-notification";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    let body: AnalysisInput = {};

    try {
      body = (await request.json()) as AnalysisInput;
    } catch {
      // Empty body — run analysis with defaults
    }

    const analysis = await runAnalysisEngine(body);
    const text = formatAnalysisNotification(analysis);
    const { messageId } = await sendTelegramMessage(text);

    return NextResponse.json({
      ok: true,
      telegramMessageId: messageId,
      verdict: analysis.step5_verdict.recommendation,
      confidence: analysis.step5_verdict.confidence,
      analyzedAt: analysis.step5_verdict.analyzedAt,
      sourceErrors: analysis.sourceErrors,
    });
  } catch (error) {
    if (error instanceof TelegramConfigError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }

    if (error instanceof TelegramApiError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode >= 400 ? error.statusCode : 502 },
      );
    }

    const message =
      error instanceof Error ? error.message : "Notification failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
