import { REALTIME_RISK_THRESHOLDS } from "./config";
import { evaluateRealTimeRisk } from "./evaluate-realtime-risk";
import type {
  OrderRiskCheckInput,
  OrderRiskCheckResult,
  RealTimeRiskInput,
} from "./types";

export function checkOrderAgainstRealTimeRisk(
  input: OrderRiskCheckInput,
): OrderRiskCheckResult {
  const { preview, report, isCloseOrder, increaseExposure } = input;
  const blockers: string[] = [];
  const warnings: string[] = [];

  if (!isCloseOrder && report.blockNewTrades) {
    blockers.push(
      `Real-time risk ${report.riskStatus} — new trades blocked.`,
    );
  }

  if (
    !isCloseOrder &&
    (increaseExposure ?? true) &&
    report.blockIncreaseExposure
  ) {
    blockers.push("Real-time risk blocks increasing exposure.");
  }

  if (report.reduceOnlyMode && !isCloseOrder && !preview.bybitPayload?.reduceOnly) {
    blockers.push("Reduce-only mode active — close orders only.");
  }

  if (!preview.valid && !isCloseOrder) {
    blockers.push(
      `Preview invalid: ${preview.rejectReasons.join("; ") || "unknown"}`,
    );
  }

  if (
    !isCloseOrder &&
    report.metrics.totalNotionalUsd + preview.estNotionalUsd >
      REALTIME_RISK_THRESHOLDS.maxNotionalExposureUsd
  ) {
    blockers.push(
      `Order would exceed max notional cap ($${REALTIME_RISK_THRESHOLDS.maxNotionalExposureUsd}).`,
    );
  }

  for (const action of report.recommendedActions) {
    warnings.push(action);
  }

  return {
    allowed: blockers.length === 0,
    blockers,
    warnings,
    reduceOnlyRequired: report.reduceOnlyMode,
    report,
  };
}

export function evaluateAndCheckOrder(input: {
  riskInput: RealTimeRiskInput;
  preview: OrderRiskCheckInput["preview"];
  isCloseOrder?: boolean;
  increaseExposure?: boolean;
}): OrderRiskCheckResult {
  const report = evaluateRealTimeRisk(input.riskInput);
  return checkOrderAgainstRealTimeRisk({
    preview: input.preview,
    report,
    isCloseOrder: input.isCloseOrder,
    increaseExposure: input.increaseExposure,
  });
}
