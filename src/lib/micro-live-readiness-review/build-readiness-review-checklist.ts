import { GOAL_MIN_TRADES_FOR_TRUST } from "@/lib/goal-engine/types";
import type {
  MicroLiveReadinessReviewBuildInput,
  ReadinessReviewChecklistItem,
  ReadinessReviewStatus,
} from "./types";

export function buildReadinessReviewChecklist(
  input: MicroLiveReadinessReviewBuildInput,
): ReadinessReviewChecklistItem[] {
  const items: ReadinessReviewChecklistItem[] = [];

  const push = (item: ReadinessReviewChecklistItem) => items.push(item);

  push({
    id: "engine_consistency_ok",
    label: "Engine consistency OK",
    passed: input.engineConsistencyOk,
    hardBlock: true,
    detail: input.engineConsistencyOk
      ? null
      : input.engineConsistencyIssue ??
        (input.monitorPositionUncertain
          ? input.monitorCurrentIssue ?? "Position state uncertain."
          : !input.monitorHealthOk
            ? input.monitorCurrentIssue ?? "Monitor health blocked."
            : input.evidenceMissingDecisionLogId > 0
              ? `${input.evidenceMissingDecisionLogId} trade(s) missing decisionLogId.`
              : "Engine consistency blocked."),
  });

  push({
    id: "binance_testnet_stable",
    label: "Binance testnet stable",
    passed: input.connected && input.testnetConfigured && !input.monitorPositionUncertain,
    hardBlock: false,
    detail:
      input.connected && input.testnetConfigured
        ? input.monitorPositionUncertain
          ? "Connected but position reconciliation uncertain."
          : null
        : "Binance testnet not connected or not configured.",
  });

  push({
    id: "twelve_valid_trades",
    label: "12 valid completed trades",
    passed: input.evidenceValidCount >= GOAL_MIN_TRADES_FOR_TRUST,
    hardBlock: true,
    detail:
      input.evidenceValidCount >= GOAL_MIN_TRADES_FOR_TRUST
        ? null
        : `${input.evidenceValidCount}/${GOAL_MIN_TRADES_FOR_TRUST} valid evidence trades.`,
  });

  push({
    id: "evidence_quality_passed",
    label: "Evidence quality passed",
    passed: input.evidenceQualityPassed,
    hardBlock: true,
    detail: input.evidenceQualityPassed
      ? null
      : input.evidenceQualityBlockReason ?? "Evidence quality insufficient for strategy review.",
  });

  push({
    id: "strategy_health_not_rejected",
    label: "Strategy health not rejected",
    passed:
      input.strategyHealthStatus !== "REJECT" &&
      input.strategyHealthStatus !== "PAUSE" &&
      !input.strategyBlocksEntries,
    hardBlock: true,
    detail:
      input.strategyHealthStatus === "REJECT" || input.strategyHealthStatus === "PAUSE"
        ? `Strategy health ${input.strategyHealthStatus}.`
        : input.strategyBlocksEntries
          ? "Strategy health blocking new testnet entries."
          : null,
  });

  push({
    id: "risk_budget_configured",
    label: "Risk budget configured",
    passed: input.riskBudgetConfigured,
    hardBlock: true,
    detail: input.riskBudgetConfigured
      ? null
      : "Integrated risk budget limits not configured.",
  });

  push({
    id: "kill_switch_working",
    label: "Kill switch working",
    passed: input.killSwitchConfigured && !input.killSwitchPaused,
    hardBlock: true,
    detail: !input.killSwitchConfigured
      ? "Kill switch daily loss threshold not configured."
      : input.killSwitchPaused
        ? "Kill switch currently paused trading."
        : null,
  });

  push({
    id: "reduce_only_close_tested",
    label: "Reduce-only close tested",
    passed: input.reduceOnlyCloseTested,
    hardBlock: true,
    detail: input.reduceOnlyCloseTested
      ? null
      : "No reduce-only / POSITION_CLOSED evidence in journal or monitor.",
  });

  push({
    id: "no_critical_incidents",
    label: "No unresolved critical incidents",
    passed: !input.criticalIncidentOpen,
    hardBlock: true,
    detail: input.criticalIncidentOpen
      ? input.criticalIncidentTitle ?? "Critical incident open."
      : null,
  });

  push({
    id: "daily_loss_limit_configured",
    label: "Daily loss limit configured",
    passed: input.dailyLossLimitConfigured,
    hardBlock: true,
    detail: input.dailyLossLimitConfigured
      ? null
      : "Daily loss limit not configured in risk budget or validation.",
  });

  push({
    id: "double_confirm_enabled",
    label: "Double confirm enabled",
    passed: input.requireDoubleConfirm,
    hardBlock: true,
    detail: input.requireDoubleConfirm
      ? null
      : "BINANCE_REQUIRE_DOUBLE_CONFIRM is disabled.",
  });

  push({
    id: "audit_trail_complete",
    label: "Audit trail complete",
    passed: input.auditTrailComplete,
    hardBlock: true,
    detail: input.auditTrailComplete
      ? null
      : "Missing CLOSED journal, PnL, or learning records on evidence trades.",
  });

  push({
    id: "telegram_operator_ready",
    label: "Telegram / operator alert ready",
    passed: input.telegramOrOperatorReady,
    hardBlock: false,
    detail: input.telegramOrOperatorReady
      ? null
      : "Configure Telegram or run operator layer cron for off-site alerts.",
  });

  return items;
}

export function resolveReadinessReviewStatus(input: {
  checklist: ReadinessReviewChecklistItem[];
  liveExecutionEnabled: boolean;
  liveBlocked: boolean;
  criticalIncidentOpen: boolean;
}): ReadinessReviewStatus {
  if (
    input.liveExecutionEnabled ||
    !input.liveBlocked ||
    (input.criticalIncidentOpen &&
      input.checklist.some((c) => c.id === "no_critical_incidents" && !c.passed))
  ) {
    return "BLOCKED";
  }

  const hardFailures = input.checklist.filter((c) => !c.passed && c.hardBlock);
  if (hardFailures.length > 0) {
    return "NOT_READY";
  }

  const softFailures = input.checklist.filter((c) => !c.passed && !c.hardBlock);
  if (softFailures.length === 0) {
    return "READY_FOR_REVIEW";
  }

  return "NOT_READY";
}

export function scoreReadinessReview(checklist: ReadinessReviewChecklistItem[]): number {
  if (checklist.length === 0) return 0;
  const passed = checklist.filter((c) => c.passed).length;
  return Math.round((passed / checklist.length) * 100);
}
