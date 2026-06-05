import type { PromotionEligibility, ScaleUpInput } from "./types";
import { getStageDefinition, nextStage } from "./stage-definitions";
import { computeLivePerformance } from "./performance-metrics";

export function evaluatePromotionEligibility(
  input: ScaleUpInput,
): PromotionEligibility {
  const target = nextStage(input.currentStage);
  if (!target) {
    return {
      targetStage: null,
      eligible: false,
      blockers: ["Already at maximum live stage."],
      requirements: [],
    };
  }

  const targetDef = getStageDefinition(target);
  const perf = computeLivePerformance(input.journal, input.incidents);
  const blockers: string[] = [];
  const requirements: PromotionEligibility["requirements"] = [];

  const readinessPass = input.readiness.overallStatus === "PASS";
  requirements.push({
    id: "live_readiness",
    label: "Live readiness",
    required: "PASS",
    actual: input.readiness.overallStatus,
    met: readinessPass,
  });
  if (!readinessPass) {
    blockers.push("Live readiness must be PASS before promotion.");
  }

  const riskOk =
    input.realTimeRisk.riskStatus === "SAFE" ||
    input.realTimeRisk.riskStatus === "CAUTION";
  requirements.push({
    id: "realtime_risk",
    label: "Real-time risk",
    required: "SAFE or CAUTION",
    actual: input.realTimeRisk.riskStatus,
    met: riskOk && !input.realTimeRisk.blockNewTrades,
  });
  if (!riskOk || input.realTimeRisk.blockNewTrades) {
    blockers.push(
      `Real-time risk ${input.realTimeRisk.riskStatus} blocks promotion.`,
    );
  }

  const criticalOpen = input.incidents.filter(
    (i) =>
      i.severity === "critical" &&
      (i.status === "open" || i.status === "investigating"),
  );
  requirements.push({
    id: "no_critical_incidents",
    label: "Critical incidents",
    required: "0 open",
    actual: String(criticalOpen.length),
    met: criticalOpen.length === 0,
  });
  if (criticalOpen.length > 0) {
    blockers.push("Unresolved critical incidents block promotion.");
  }

  requirements.push({
    id: "closed_trades",
    label: "Closed live trades",
    required: `≥ ${targetDef.requiredClosedTrades}`,
    actual: String(perf.closedTrades),
    met: perf.closedTrades >= targetDef.requiredClosedTrades,
  });
  if (perf.closedTrades < targetDef.requiredClosedTrades) {
    blockers.push(
      `Need ${targetDef.requiredClosedTrades} closed trades (have ${perf.closedTrades}).`,
    );
  }

  requirements.push({
    id: "win_rate",
    label: "Win rate",
    required: `≥ ${targetDef.requiredWinRate}%`,
    actual: `${perf.winRatePct}%`,
    met: perf.winRatePct >= targetDef.requiredWinRate,
  });
  if (perf.winRatePct < targetDef.requiredWinRate) {
    blockers.push(
      `Win rate ${perf.winRatePct}% below ${targetDef.requiredWinRate}% threshold.`,
    );
  }

  requirements.push({
    id: "max_drawdown",
    label: "Max drawdown",
    required: `≤ ${targetDef.requiredMaxDrawdown}%`,
    actual: `${perf.maxDrawdownPct}%`,
    met: perf.maxDrawdownPct <= targetDef.requiredMaxDrawdown,
  });
  if (perf.maxDrawdownPct > targetDef.requiredMaxDrawdown) {
    blockers.push(
      `Drawdown ${perf.maxDrawdownPct}% exceeds ${targetDef.requiredMaxDrawdown}% cap.`,
    );
  }

  requirements.push({
    id: "incident_free_days",
    label: "Incident-free days",
    required: `≥ ${targetDef.requiredIncidentFreeDays}`,
    actual: String(perf.incidentFreeDays),
    met: perf.incidentFreeDays >= targetDef.requiredIncidentFreeDays,
  });
  if (perf.incidentFreeDays < targetDef.requiredIncidentFreeDays) {
    blockers.push(
      `Need ${targetDef.requiredIncidentFreeDays} incident-free days (have ${perf.incidentFreeDays}).`,
    );
  }

  if (input.emergencyStopActive) {
    blockers.push("Emergency stop active — promotion blocked.");
  }

  if (targetDef.requiresManualApproval) {
    requirements.push({
      id: "manual_approval",
      label: "Operator approval",
      required: "Required at promote",
      actual: "Pending on promote action",
      met: true,
    });
  }

  return {
    targetStage: target,
    eligible: blockers.length === 0,
    blockers,
    requirements,
  };
}
