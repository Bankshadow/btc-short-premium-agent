import type { CouncilSessionContext } from "./council-context";
import type { CouncilAgentDebateRow } from "./types";
import type { CouncilSessionResult } from "./types";

export function runCapitalAllocatorAgent(
  ctx: CouncilSessionContext,
): {
  capitalRecommendation: CouncilSessionResult["capitalRecommendation"];
  debate: CouncilAgentDebateRow;
} {
  const split = ctx.capitalReport.split;
  const stage = ctx.capitalReport.stage;
  const validation = ctx.validation.capitalAllocation;

  const aggressiveBlocked =
    !validation.aggressiveModeAllowed ||
    !ctx.capitalReport.scalePermission.allowed ||
    stage.progressToGoalPct < 15;

  const councilNote = aggressiveBlocked
    ? `Milestone band ${stage.current.label}: aggressive sleeve blocked until more proof (progress ${stage.progressToGoalPct}%).`
    : `Aligned with MVP 10 validation split at stage floor $${stage.stageEntryUsd.toLocaleString()}.`;

  const debate: CouncilAgentDebateRow = {
    agentName: "Capital Allocator Agent",
    role: "Reserve / core / growth / experimental",
    stance: aggressiveBlocked ? "challenge" : "neutral",
    statements: [
      `Recommend reserve ${split.buckets.find((b) => b.key === "protected_reserve")?.pct ?? validation.reservePct}% · core ${validation.coreStrategyPct}% · growth ${validation.growthStrategyPct}%.`,
      councilNote,
      aggressiveBlocked
        ? "Cannot increase aggressive allocation without additional resolved edge and scale permission."
        : "Paper growth sleeve may expand only after human approves council proposals.",
      `Experimental cap remains ≤ validation max — no live transfers.`,
    ],
  };

  return {
    capitalRecommendation: {
      ...validation,
      summary: `${validation.summary} · ${councilNote}`,
      councilNote,
      aggressiveIncreaseBlocked: aggressiveBlocked,
    },
    debate,
  };
}
