import type { AnalyzeApiResponse } from "@/lib/types/market";
import type { AutopilotRunResult } from "@/lib/autopilot/types";
import { emitAiStatusEvent } from "./event-store";

/** Emit operator-friendly pipeline events after a desk analyze cycle. */
export async function emitAnalyzePipelineEvents(input: {
  runId: string;
  analysis: AnalyzeApiResponse;
  autopilot?: AutopilotRunResult | null;
  previewCreated?: boolean;
  orderExecuted?: boolean;
  learningUpdated?: boolean;
}): Promise<void> {
  const { runId, analysis, autopilot } = input;
  const verdict = analysis.tradingDesk?.committee?.finalVerdict ?? "WAIT";

  await emitAiStatusEvent({
    type: "ANALYSIS_STARTED",
    runId,
    detail: "Desk analyze cycle initiated",
    technical: `runId=${runId}`,
  });

  await emitAiStatusEvent({
    type: "MARKET_FETCHED",
    runId,
    detail: `BTC $${analysis.step1_marketSnapshot?.spotPrice?.toLocaleString() ?? "—"}`,
    technical: `spot=${analysis.step1_marketSnapshot?.spotPrice}`,
  });

  if (analysis.tradingDesk) {
    await emitAiStatusEvent({
      type: "AGENTS_REVIEWED",
      runId,
      detail: `Regime ${analysis.tradingDesk.marketRegime} · ${analysis.tradingDesk.agents.length} agents`,
      technical: `regime=${analysis.tradingDesk.marketRegime}`,
    });

    await emitAiStatusEvent({
      type: "RISK_CHECKED",
      runId,
      detail: analysis.tradingDesk.committee.riskVeto
        ? "Risk veto active"
        : "Risk gates passed",
      technical: `veto=${analysis.tradingDesk.committee.riskVeto}`,
    });
  }

  if (verdict === "TRADE") {
    await emitAiStatusEvent({
      type: "TRADE_CANDIDATE_CREATED",
      runId,
      detail: `Committee TRADE · ${analysis.step5_verdict?.confidence ?? 0}% confidence`,
      technical: `verdict=TRADE`,
    });
  }

  if (input.previewCreated) {
    await emitAiStatusEvent({
      type: "TESTNET_PREVIEW_CREATED",
      runId,
      detail: "Testnet preview queued for operator review",
    });
  }

  if ((autopilot?.blockers.length ?? 0) > 0) {
    await emitAiStatusEvent({
      type: "PERMISSION_REQUESTED",
      runId,
      detail: autopilot?.blockers[0] ?? "Human confirmation needed",
    });
  }

  if (input.orderExecuted) {
    await emitAiStatusEvent({
      type: "ORDER_EXECUTED",
      runId,
      detail: "Testnet order placed",
    });
  }

  const openPositions = autopilot?.portfolioSnapshot?.openPaperTrades ?? 0;
  if (openPositions > 0 || autopilot?.finalVerdict === "TRADE") {
    await emitAiStatusEvent({
      type: "POSITION_MONITORED",
      runId,
      detail: `Monitoring ${openPositions} open position(s)`,
    });
  }

  if (input.learningUpdated) {
    await emitAiStatusEvent({
      type: "LEARNING_UPDATED",
      runId,
      detail: "Self-learning snapshot refreshed",
    });
  }
}
