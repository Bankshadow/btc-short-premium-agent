import type { QuantImportStatus } from "@/lib/quant-strategy-importer/types";
import type { GarageShadowSummary, StrategyGarageRecord, StrategyGarageStage } from "./types";

export function deriveGarageStage(input: {
  record: StrategyGarageRecord | null;
  importStatus: QuantImportStatus;
  shadow?: GarageShadowSummary | null;
}): StrategyGarageStage {
  const record = input.record;
  if (input.importStatus === "REJECTED" || record?.stage === "REJECTED") {
    return "REJECTED";
  }
  if (record?.approvedForAiLoop && record.stage === "APPROVED_FOR_USE") {
    return "APPROVED_FOR_USE";
  }
  if (input.importStatus === "READY_FOR_PAPER") {
    return "TESTNET_READY";
  }
  if (input.shadow && input.shadow.closedTrades > 0) {
    return "SHADOW_TESTING";
  }
  if (record?.lastBacktest || input.importStatus === "READY_FOR_BACKTEST") {
    return "BACKTEST_READY";
  }
  if (record?.aiReviewedAt || record?.aiReviewSummary) {
    return "AI_REVIEWED";
  }
  return "IMPORTED";
}

export function nextGarageAction(stage: StrategyGarageStage): string {
  switch (stage) {
    case "IMPORTED":
      return "Run AI review, then promote to backtest queue.";
    case "AI_REVIEWED":
      return "Run historical backtest on BTC/SOL klines.";
    case "BACKTEST_READY":
      return "Run shadow replay and compare vs AI committee.";
    case "SHADOW_TESTING":
      return "Promote to testnet-ready after shadow evidence + human approval.";
    case "TESTNET_READY":
      return "Trial on testnet with double confirm — not AI loop yet.";
    case "APPROVED_FOR_USE":
      return "Advisory signals may feed AI desk — execution still blocked.";
    case "REJECTED":
      return "Strategy rejected — reset to imported to re-evaluate.";
    default:
      return "Review in Strategy Garage.";
  }
}
