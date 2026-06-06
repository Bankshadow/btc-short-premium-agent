import { runAnalysisEngine } from "@/lib/decision/analyze";
import {
  appendObservabilityError,
  loadObservabilityMetrics,
  saveObservabilityMetrics,
} from "@/lib/observability/store";
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
    const metrics = await loadObservabilityMetrics();
    await saveObservabilityMetrics({
      lastAlertDeliveryAt: new Date().toISOString(),
      alertDeliveryFailures: Math.max(0, metrics.alertDeliveryFailures - 1),
    });

    return NextResponse.json({
      ok: true,
      telegramMessageId: messageId,
      verdict: analysis.verdict.recommendation,
      confidence: analysis.verdict.confidence,
      analyzedAt: analysis.dataTimestamp,
      dataSourceIssues: analysis.dataSourceIssues,
      sourceErrors: analysis.sourceErrors,
    });
  } catch (error) {
    const metrics = await loadObservabilityMetrics();
    await saveObservabilityMetrics({
      alertDeliveryFailures: metrics.alertDeliveryFailures + 1,
    });
    await appendObservabilityError({
      workspaceId: "server-default",
      source: "api:notify",
      message: error instanceof Error ? error.message : "Notification failed",
      severity: "high",
    });

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
