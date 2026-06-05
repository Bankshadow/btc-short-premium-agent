import { VALIDATION_THRESHOLDS } from "@/lib/validation/validation-config";
import type { CouncilSessionContext } from "./council-context";
import type { CouncilAgentDebateRow, CouncilProposal, CouncilRiskReview } from "./types";

export function runRiskCriticAgent(
  ctx: CouncilSessionContext,
  proposals: CouncilProposal[],
): { riskReview: CouncilRiskReview; debate: CouncilAgentDebateRow } {
  const t = VALIDATION_THRESHOLDS;
  const dd = ctx.validation.killSwitch.peakToTroughDrawdownPct;
  const resolved = ctx.scoreboard.totalResolved;

  const items = proposals.map((p) => {
    const thinSample = resolved < p.requiredSampleSize;
    const ddHigh = dd >= t.maxDrawdownWatchPct;
    let recommendation: "approve_paper" | "reject" | "need_more_data" = "need_more_data";

    if (thinSample || resolved < 5) {
      recommendation = "need_more_data";
    } else if (p.targetStrategy !== "desk" && ddHigh) {
      recommendation = "reject";
    } else if (p.testMode === "shadow_log" || p.testMode === "paper_only") {
      recommendation = "approve_paper";
    } else {
      recommendation = "need_more_data";
    }

    return {
      proposalId: p.id,
      drawdownRisk: ddHigh
        ? `Portfolio DD ${dd}% — do not add risk until below ${t.maxDrawdownWatchPct}%.`
        : "Drawdown within watch band for paper tests.",
      overfittingRisk:
        resolved < 15
          ? "Low resolved count — regime-specific tweaks may overfit."
          : "Moderate — validate on replay before promotion.",
      sampleSizeWeakness: thinSample
        ? `Need ${p.requiredSampleSize} resolved; have ${resolved}.`
        : "Sample threshold met for paper-only path.",
      recommendation,
      summary:
        recommendation === "approve_paper"
          ? "Safe for paper/shadow test only."
          : recommendation === "reject"
            ? "Reject until risk metrics improve."
            : "Gather more resolved sessions first.",
    };
  });

  const globalWarnings: string[] = [
    "Hard risk rules remain locked — council cannot waive them.",
    "No automatic position size increases permitted.",
  ];
  if (ctx.hardRulesLocked.locked) {
    globalWarnings.push(
      `Hard rules active: ${ctx.hardRulesLocked.activeRules.join(", ")}.`,
    );
  }
  if (!ctx.capitalReport.scalePermission.allowed) {
    globalWarnings.push("Desk scale permission blocked — do not accelerate capital sleeves.");
  }

  const riskReview: CouncilRiskReview = {
    hardRulesLocked: true,
    noLiveExecution: true,
    noAutoPositionIncrease: true,
    items,
    globalWarnings,
  };

  const debate: CouncilAgentDebateRow = {
    agentName: "Risk Critic Agent",
    role: "Challenge proposals — DD, overfit, sample size",
    stance: "challenge",
    statements: [
      ...globalWarnings,
      `Reviewed ${proposals.length} proposals: ${items.filter((i) => i.recommendation === "approve_paper").length} ok for paper, ${items.filter((i) => i.recommendation === "reject").length} reject, ${items.filter((i) => i.recommendation === "need_more_data").length} need data.`,
      ctx.capitalReport.riskOfRuin.level !== "low"
        ? `Ruin warning level ${ctx.capitalReport.riskOfRuin.level} — bias to PAPER_ONLY.`
        : "Ruin indicators acceptable for controlled paper tests.",
      ctx.relevantMemory.lessons.find((l) => l.bullet.toLowerCase().includes("drawdown"))
        ? `Memory graph flags drawdown pattern: ${ctx.relevantMemory.lessons.find((l) => l.bullet.toLowerCase().includes("drawdown"))!.bullet}`
        : "No drawdown pattern in memory graph for current context.",
    ],
  };

  return { riskReview, debate };
}
