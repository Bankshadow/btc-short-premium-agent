import { NextResponse } from "next/server";
import { blockBinanceProductionOrder } from "@/lib/exchange/binance/binance-config";
import {
  loadCentralAnalysisBundle,
  toAnalysisUiView,
} from "@/lib/analysis-engine/analysis-engine";
import { buildMissionFlowServerSnapshot } from "@/lib/mission-flow/build-server-snapshot";
import { queryEngineEvents } from "@/lib/engine-event-bus/engine-event-bus";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const liveBlock = blockBinanceProductionOrder();
    const [{ state, latest }, missionResult, engineEvents] = await Promise.all([
      loadCentralAnalysisBundle(),
      buildMissionFlowServerSnapshot().catch(() => null),
      queryEngineEvents({ limit: 50 }),
    ]);

    return NextResponse.json({
      ok: true,
      mvp: state.mvp,
      label: state.label,
      state,
      latest: latest
        ? {
            ...latest,
            analyzeResponse: undefined,
            context: undefined,
          }
        : null,
      ui: toAnalysisUiView({
        state,
        result: latest,
        mission: missionResult?.snapshot ?? null,
      }),
      events: engineEvents.events,
      eventsTotal: engineEvents.total,
      liveTradingLocked: true,
      liveBlock,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Analysis state failed",
      },
      { status: 500 },
    );
  }
}
