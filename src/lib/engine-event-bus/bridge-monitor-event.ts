import type { TestnetMonitorJournalEvent, TestnetMonitorEventType } from "@/lib/testnet-monitor/types";
import { emitEngineEvent } from "./emit-engine-event";
import type { EngineEventType } from "./types";

const MONITOR_TO_ENGINE: Partial<Record<TestnetMonitorEventType, EngineEventType>> = {
  PREVIEW_CREATED: "PREVIEW_CREATED",
  ORDER_EXECUTED: "ORDER_EXECUTED",
  POSITION_OPENED: "POSITION_OPENED",
  CLOSE_REQUESTED: "PERMISSION_REQUESTED",
  POSITION_CLOSED: "POSITION_CLOSED",
  PNL_REALIZED: "PNL_REALIZED",
  LEARNING_UPDATED: "LEARNING_CREATED",
  STRATEGY_HEALTH_REVIEWED: "REPORT_UPDATED",
  READINESS_CHECKED: "READINESS_CHECKED",
  TRADE_QUALITY_SCORED: "REPORT_UPDATED",
  CONFIDENCE_CALIBRATED: "REPORT_UPDATED",
  RISK_BUDGET_RECOMMENDED: "REPORT_UPDATED",
  DAILY_SELF_REVIEW_CREATED: "REPORT_UPDATED",
  CENTRAL_ANALYSIS_COMPLETED: "VERDICT_CREATED",
};

export async function bridgeMonitorEventToEngineBus(
  event: TestnetMonitorJournalEvent,
): Promise<void> {
  const mapped = MONITOR_TO_ENGINE[event.eventType];
  if (!mapped) return;

  const payload = event.payload ?? {};
  const previewId =
    typeof payload.previewId === "string" ? payload.previewId : null;
  const runId = typeof payload.runId === "string" ? payload.runId : null;
  const tradeId =
    event.positionId ??
    (typeof payload.closedTradeId === "string" ? payload.closedTradeId : null) ??
    (typeof payload.tradeId === "string" ? payload.tradeId : null);

  let summary = `${event.eventType.replace(/_/g, " ").toLowerCase()}`;
  if (event.symbol) summary += ` · ${event.symbol}`;
  if (typeof payload.finalVerdict === "string") {
    summary = `Verdict ${payload.finalVerdict}`;
  }
  if (typeof payload.netPnl === "number") {
    summary = `PnL realized · ${payload.netPnl.toFixed(2)} USD`;
  }

  await emitEngineEvent({
    type: mapped,
    summary,
    runId,
    decisionLogId: event.decisionLogId,
    tradeId,
    previewId,
    symbol: event.symbol,
    payload: payload as Record<string, unknown>,
  });
}
