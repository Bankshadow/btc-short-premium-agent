import { NextResponse } from "next/server";
import { blockBinanceProductionOrder } from "@/lib/exchange/binance/binance-config";
import {
  runCentralAnalysisOrchestrator,
  stripAnalysisResultForClient,
  toAnalysisUiView,
} from "@/lib/analysis-engine/analysis-engine";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const liveBlock = blockBinanceProductionOrder();
    if (liveBlock) {
      return NextResponse.json(
        {
          ok: false,
          error: liveBlock,
          liveTradingLocked: true,
          autoExecuteBlocked: true,
        },
        { status: 403 },
      );
    }

    let body: Record<string, unknown> = {};
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      body = {};
    }

    const trigger =
      body.trigger === "start_ai" ||
      body.trigger === "automation" ||
      body.trigger === "manual"
        ? body.trigger
        : "api";

    const output = await runCentralAnalysisOrchestrator({
      trigger,
      runId: typeof body.runId === "string" ? body.runId : undefined,
      enrichMvp9: body.enrichMvp9 !== false,
      runAutopilot: body.runAutopilot !== false,
      createTestnetPreview: body.createTestnetPreview !== false,
    });

    const clientResult = stripAnalysisResultForClient(output.result);

    return NextResponse.json({
      ok: output.ok,
      runId: output.runId,
      decisionLogId: output.result.decisionLogId,
      result: clientResult,
      ui: toAnalysisUiView({ state: output.state, result: output.result }),
      deskRunId: output.deskRun?.runId ?? null,
      previewId: output.result.tradeCandidate?.previewId ?? null,
      liveTradingLocked: true,
      autoExecuteBlocked: true,
      safetyNotice:
        "Central analysis completed — no orders executed. Testnet preview requires double confirm.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Analysis run failed",
        liveTradingLocked: true,
        autoExecuteBlocked: true,
      },
      { status: 500 },
    );
  }
}
