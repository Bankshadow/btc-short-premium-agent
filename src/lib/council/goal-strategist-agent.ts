import { MISSION_GOAL_USD } from "@/lib/capital/capital-mission-config";
import type { CouncilSessionContext } from "./council-context";
import type { CouncilAgentDebateRow, CouncilGoalStatus } from "./types";

export function runGoalStrategistAgent(ctx: CouncilSessionContext): {
  goalStatus: CouncilGoalStatus;
  debate: CouncilAgentDebateRow;
} {
  const stage = ctx.capitalReport.stage;
  const resolved = ctx.portfolio.resolvedLogCount;
  const netPct = ctx.portfolio.netLogPaperPnlPct;

  let paceAssessment: string;
  if (resolved < 5) {
    paceAssessment = "Insufficient resolved sessions to estimate pace — prioritize paper logging.";
  } else if (netPct > 0 && stage.progressToGoalPct > 5) {
    paceAssessment = "Positive paper pace — maintain discipline before scaling sleeves.";
  } else if (netPct <= 0) {
    paceAssessment = "Flat or negative paper pace — fix edge before capital scaling.";
  } else {
    paceAssessment = "Early mission band — focus on sample quality over speed.";
  }

  let bottleneck: string;
  if (resolved < 8) {
    bottleneck = "Sample size — need more resolved outcomes for council confidence.";
  } else if (!ctx.capitalReport.scalePermission.allowed) {
    bottleneck = "Scale permission blocked — address drawdown, overrides, or strategy gates.";
  } else if (stage.distanceToGoalUsd > 15000) {
    bottleneck = "Distance to $20k — compound only after repeatable positive avg R per strategy.";
  } else if (ctx.hardRulesLocked.locked) {
    bottleneck = "Hard rule lock active — clear data quality or loss limits before acceleration.";
  } else {
    bottleneck = "Strategy dispersion — concentrate on best regime/strategy pair from validation matrix.";
  }

  const goalStatus: CouncilGoalStatus = {
    currentEquityUsd: ctx.currentEquityUsd,
    startingCapitalUsd: ctx.startingCapitalUsd,
    goalCapitalUsd: ctx.goalCapitalUsd || MISSION_GOAL_USD,
    stageLabel: stage.current.label,
    nextMilestoneUsd: stage.nextMilestone?.floorUsd ?? null,
    distanceToNextUsd: stage.distanceToNextUsd,
    distanceToGoalUsd: stage.distanceToGoalUsd,
    progressToGoalPct: stage.progressToGoalPct,
    paceAssessment,
    bottleneck,
  };

  const debate: CouncilAgentDebateRow = {
    agentName: "Goal Strategist Agent",
    role: "Mission pace & milestone bottleneck",
    stance: netPct >= 0 ? "support" : "challenge",
    statements: [
      `Equity ~$${ctx.currentEquityUsd.toLocaleString()} in band ${stage.current.label}.`,
      `Progress to $${(ctx.goalCapitalUsd / 1000).toFixed(0)}k goal: ${stage.progressToGoalPct}%.`,
      stage.distanceToNextUsd != null
        ? `$${stage.distanceToNextUsd.toLocaleString()} to next milestone.`
        : "At or above final milestone band.",
      `Bottleneck: ${bottleneck}`,
      paceAssessment,
    ],
  };

  return { goalStatus, debate };
}
