import type { DeskRiskProfile } from "@/lib/desk/desk-risk-policy";
import { evaluateKillSwitch } from "@/lib/validation/kill-switch";
import { effectivePilotMaxNotional } from "./pilot-config";
import { computePilotDailyMetrics } from "./pilot-metrics";
import { checkScaleUpGuards } from "@/lib/live-scale-up/scale-guards";
import { defaultScaleStage } from "@/lib/live-scale-up/stage-definitions";
import { pilotExecutionAllowed } from "./pilot-mode";
import type { PilotGuardInput, PilotGuardResult } from "./types";

export function checkPilotGuards(input: PilotGuardInput): PilotGuardResult {
  const blockers: string[] = [];
  const warnings: string[] = [];
  const { config, mode, preview, journal } = input;

  if (config.emergencyStopEnv || input.emergencyStopActive) {
    blockers.push("Emergency stop active — all live pilot orders blocked.");
  }

  if (!config.pilotEnabled && mode !== "LIVE_TESTNET") {
    blockers.push("PILOT_ENABLED is false — small live pilot disabled.");
  }

  if (!pilotExecutionAllowed(mode)) {
    blockers.push(`Live pilot mode ${mode} does not allow execution.`);
  }

  if (!config.liveExecutionEnabled) {
    blockers.push("LIVE_EXECUTION_ENABLED is not true.");
  }

  if (preview.category === "option") {
    blockers.push("BTC options live execution is not available.");
  }

  if (!preview.valid && !input.isCloseOrder) {
    blockers.push(
      `Preview invalid: ${preview.rejectReasons.join("; ") || "unknown"}`,
    );
  }

  const symbol = preview.symbol.toUpperCase();
  if (config.allowedSymbols && !config.allowedSymbols.includes(symbol)) {
    blockers.push(`Symbol ${symbol} not in LIVE_ALLOWED_SYMBOLS.`);
  }

  const maxNotional = effectivePilotMaxNotional(config);
  if (preview.estNotionalUsd > maxNotional && !input.isCloseOrder) {
    blockers.push(
      `Notional $${preview.estNotionalUsd.toFixed(2)} exceeds pilot cap $${maxNotional}.`,
    );
  }

  const metrics = computePilotDailyMetrics(journal, config);

  if (!input.isCloseOrder && metrics.tradesToday >= config.dailyTradeLimit) {
    blockers.push(
      `Daily trade limit reached (${metrics.tradesToday}/${config.dailyTradeLimit}).`,
    );
  }

  if (metrics.realizedPnlTodayUsd <= -config.dailyLossLimitUsd) {
    blockers.push(
      `Daily loss limit breached ($${Math.abs(metrics.realizedPnlTodayUsd).toFixed(2)} / $${config.dailyLossLimitUsd}).`,
    );
  }

  if (metrics.realizedPnlWeekUsd <= -config.weeklyLossLimitUsd) {
    blockers.push(
      `Weekly loss limit breached ($${Math.abs(metrics.realizedPnlWeekUsd).toFixed(2)} / $${config.weeklyLossLimitUsd}).`,
    );
  }

  if (!input.isCloseOrder && metrics.inCooldown) {
    blockers.push(
      `Cooldown after loss until ${metrics.cooldownUntil ? new Date(metrics.cooldownUntil).toLocaleString() : "unknown"}.`,
    );
  }

  if (input.readinessStatus === "FAIL") {
    blockers.push("Live readiness checklist is FAIL — clear blockers on /live-readiness.");
  } else if (input.readinessStatus === "WARNING") {
    warnings.push("Live readiness is WARNING — proceed with caution.");
  }

  const gov = input.governance;
  if (
    gov?.pauseAnalysis ||
    gov?.safeMode ||
    gov?.operatorPaused ||
    gov?.pausePaperAutoOpen
  ) {
    blockers.push("Governance pause active.");
  }

  const criticalIncidents = (input.incidents ?? []).filter(
    (i) =>
      i.severity === "critical" &&
      (i.status === "open" || i.status === "investigating"),
  );
  if (criticalIncidents.length > 0) {
    blockers.push(`${criticalIncidents.length} unresolved critical incident(s).`);
  }

  const kill = evaluateKillSwitch({
    entries: input.entries ?? [],
    orders: input.orders ?? [],
    riskProfile: (input.entries?.[0]?.deskRiskProfile as DeskRiskProfile) ?? "balanced",
  });
  if (kill.tradingPaused) {
    blockers.push(`Kill switch active: ${kill.messages.join(" ")}`);
  }

  const budget = input.riskBudget;
  if (
    budget &&
    !input.isCloseOrder &&
    (!budget.liveTradingAllowed || budget.recommendedRiskPct <= 0)
  ) {
    blockers.push(
      budget.blockReasons[0] ??
        `Risk budget blocks live entry (${budget.recommendedRiskPct}% allowed).`,
    );
  }

  if (
    budget &&
    !input.isCloseOrder &&
    preview.estNotionalUsd > budget.recommendedPositionSizeUsd &&
    budget.recommendedPositionSizeUsd > 0
  ) {
    blockers.push(
      `Preview notional $${preview.estNotionalUsd.toFixed(2)} exceeds risk budget $${budget.recommendedPositionSizeUsd.toFixed(2)}.`,
    );
  }

  const scaleStage = input.scaleStage ?? defaultScaleStage();
  const scale = checkScaleUpGuards({
    stage: scaleStage,
    preview,
    journal,
    isCloseOrder: input.isCloseOrder,
  });
  blockers.push(...scale.blockers);
  warnings.push(...scale.warnings);

  const rt = input.realTimeRiskReport;
  if (rt && !input.isCloseOrder) {
    if (rt.blockNewTrades) {
      blockers.push(
        `Real-time risk ${rt.riskStatus} — new trades blocked.`,
      );
    }
    if (rt.reduceOnlyMode && !preview.bybitPayload?.reduceOnly) {
      blockers.push("Reduce-only mode active — close orders only.");
    }
  }

  if (!input.isCloseOrder) {
    if (!input.operatorApproval) {
      blockers.push("Human operator approval required before execute.");
    }
    if (config.requireDoubleConfirm && !input.doubleConfirm) {
      blockers.push("doubleConfirm must be true for live pilot execute.");
    }
  }

  return {
    allowed: blockers.length === 0,
    blockers,
    warnings,
  };
}
