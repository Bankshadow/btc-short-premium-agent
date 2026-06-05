import type { ScaleUpInput, DemotionTrigger, LiveScaleStage } from "./types";
import {
  defaultScaleStage,
  getStageDefinition,
  previousStage,
} from "./stage-definitions";

const DEFAULT_MAX_SLIPPAGE_PCT = Number(
  process.env.SCALE_UP_MAX_SLIPPAGE_PCT ?? 0.75,
);

export function evaluateDemotionTriggers(input: ScaleUpInput): DemotionTrigger[] {
  const triggers: DemotionTrigger[] = [];
  const perf = input.journal;
  const metrics = input.realTimeRisk.metrics;
  const maxSlippage = input.maxSlippagePct ?? DEFAULT_MAX_SLIPPAGE_PCT;

  const closedToday = perf.filter(
    (j) =>
      j.status === "CLOSED" &&
      j.closedAt &&
      Date.parse(j.closedAt) >= startOfDayMs(),
  );
  const dailyLoss = closedToday.reduce((s, j) => s + (j.realizedPnl ?? 0), 0);
  if (input.currentStage !== "LIVE_STAGE_0_DISABLED") {
    const stageDef = getStageDefinition(input.currentStage);
    if (dailyLoss <= -stageDef.maxDailyLoss) {
      triggers.push({
        id: "daily_loss_breach",
        label: "Daily loss limit",
        active: true,
        severity: "critical",
        message: `Daily loss $${Math.abs(dailyLoss).toFixed(2)} breached stage cap $${stageDef.maxDailyLoss}.`,
        autoDemote: true,
      });
    }
    const weekLoss = perf
      .filter(
        (j) =>
          j.status === "CLOSED" &&
          j.closedAt &&
          Date.parse(j.closedAt) >= startOfWeekMs(),
      )
      .reduce((s, j) => s + (j.realizedPnl ?? 0), 0);
    if (weekLoss <= -stageDef.maxWeeklyLoss) {
      triggers.push({
        id: "weekly_loss_breach",
        label: "Weekly loss limit",
        active: true,
        severity: "critical",
        message: `Weekly loss $${Math.abs(weekLoss).toFixed(2)} breached stage cap $${stageDef.maxWeeklyLoss}.`,
        autoDemote: true,
      });
    }
  }

  const criticalIncidents = input.incidents.filter(
    (i) =>
      i.severity === "critical" &&
      (i.status === "open" || i.status === "investigating"),
  );
  if (criticalIncidents.length > 0) {
    triggers.push({
      id: "critical_incident",
      label: "Critical incident",
      active: true,
      severity: "critical",
      message: `${criticalIncidents.length} unresolved critical incident(s).`,
      autoDemote: true,
    });
  }

  const recentIncidents = input.incidents.filter((i) => {
    const ts = Date.parse(i.createdAt);
    return Number.isFinite(ts) && ts >= Date.now() - 24 * 60 * 60 * 1000;
  });
  if (recentIncidents.length > 0 && input.currentStage !== "LIVE_STAGE_0_DISABLED") {
    triggers.push({
      id: "incident_created",
      label: "Incident created",
      active: true,
      severity: "warning",
      message: `${recentIncidents.length} incident(s) in last 24h.`,
      autoDemote: true,
    });
  }

  const mismatch = input.realTimeRisk.checks.find(
    (c) => c.id === "live_position_mismatch" && c.status === "WARNING",
  );
  if (mismatch) {
    triggers.push({
      id: "exchange_mismatch",
      label: "Exchange mismatch",
      active: true,
      severity: "warning",
      message: mismatch.message,
      autoDemote: true,
    });
  }

  const orderMismatch = input.realTimeRisk.checks.find(
    (c) => c.id === "open_order_mismatch" && c.status === "WARNING",
  );
  if (orderMismatch) {
    triggers.push({
      id: "open_order_mismatch",
      label: "Open order mismatch",
      active: true,
      severity: "warning",
      message: orderMismatch.message,
      autoDemote: true,
    });
  }

  const highSlippage = perf.filter(
    (j) => j.slippage != null && j.slippage > maxSlippage,
  );
  if (highSlippage.length > 0) {
    triggers.push({
      id: "slippage_threshold",
      label: "Slippage threshold",
      active: true,
      severity: "warning",
      message: `${highSlippage.length} trade(s) exceeded ${maxSlippage}% slippage.`,
      autoDemote: true,
    });
  }

  if (
    input.realTimeRisk.riskStatus === "BLOCKED" ||
    input.realTimeRisk.riskStatus === "EMERGENCY"
  ) {
    triggers.push({
      id: "realtime_risk_blocked",
      label: "Real-time risk blocked",
      active: true,
      severity: input.realTimeRisk.riskStatus === "EMERGENCY" ? "critical" : "warning",
      message: `Real-time risk ${input.realTimeRisk.riskStatus}.`,
      autoDemote: true,
    });
  }

  if (input.emergencyStopActive) {
    triggers.push({
      id: "operator_emergency_stop",
      label: "Operator emergency stop",
      active: true,
      severity: "critical",
      message: "Live pilot emergency stop active.",
      autoDemote: true,
    });
  }

  if (!triggers.some((t) => t.id === "daily_loss_breach")) {
    triggers.push({
      id: "daily_loss_breach",
      label: "Daily loss limit",
      active: false,
      severity: "warning",
      message: "Within stage daily loss cap.",
      autoDemote: false,
    });
  }

  return triggers;
}

export function resolveAutoDemotion(input: ScaleUpInput): {
  shouldAutoDemote: boolean;
  targetStage: LiveScaleStage | null;
  reasons: string[];
} {
  if (input.currentStage === "LIVE_STAGE_0_DISABLED") {
    return { shouldAutoDemote: false, targetStage: null, reasons: [] };
  }

  const triggers = evaluateDemotionTriggers(input).filter((t) => t.active && t.autoDemote);
  if (triggers.length === 0) {
    return { shouldAutoDemote: false, targetStage: null, reasons: [] };
  }

  const reasons = triggers.map((t) => t.message);
  const critical = triggers.some((t) => t.severity === "critical");

  if (critical || input.emergencyStopActive || input.realTimeRisk.riskStatus === "EMERGENCY") {
    return {
      shouldAutoDemote: true,
      targetStage: defaultScaleStage(),
      reasons,
    };
  }

  return {
    shouldAutoDemote: true,
    targetStage: previousStage(input.currentStage) ?? defaultScaleStage(),
    reasons,
  };
}

function startOfDayMs(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function startOfWeekMs(): number {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
