import { VALIDATION_THRESHOLDS } from "@/lib/validation/validation-config";
import type { CouncilSessionContext } from "./council-context";
import type { PerformanceAnalystInsight } from "./performance-analyst-agent";
import type { CouncilAgentDebateRow, CouncilProposal } from "./types";

function proposalId(): string {
  return `prop-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function runStrategyOptimizerAgent(
  ctx: CouncilSessionContext,
  perf: PerformanceAnalystInsight,
): { proposals: CouncilProposal[]; debate: CouncilAgentDebateRow } {
  const t = VALIDATION_THRESHOLDS;
  const proposals: CouncilProposal[] = [];
  const matrix = ctx.validation.strategyMatrix;

  const bestRow = [...matrix].sort((a, b) => b.averageR - a.averageR)[0];
  const worstRow = [...matrix].sort((a, b) => a.averageR)[0];

  if (bestRow && bestRow.resolvedSignals >= t.minSignalsWatchlist) {
    proposals.push({
      id: proposalId(),
      title: `Paper-test concentration on ${bestRow.label}`,
      targetStrategy: bestRow.id,
      problemObserved: `Dispersed edge; ${bestRow.label} shows avg R ${bestRow.averageR} over ${bestRow.resolvedSignals} signals.`,
      proposedChange:
        "Allocate paper test budget to this strategy in current regime; reduce parallel TRADE paths elsewhere.",
      expectedBenefit: "Faster sample accumulation on strongest sleeve without live capital.",
      riskConcern: "Regime shift may invalidate historical edge.",
      requiredSampleSize: t.minSignalsForActive,
      testMode: "paper_only",
      status: "DRAFT",
      linkedDraftRuleHint: `When ${bestRow.label} signals TRADE in matching regime, prioritize paper log resolution within 24h.`,
    });
  }

  if (worstRow && worstRow.averageR < t.avgRDisable && worstRow.resolvedSignals >= 5) {
    proposals.push({
      id: proposalId(),
      title: `Demote ${worstRow.label} to paper-only filters`,
      targetStrategy: worstRow.id,
      problemObserved: perf.worstStrategy + ` — negative avg R with ${worstRow.falsePositives} false positives.`,
      proposedChange:
        "Tighten entry checklist (IV/HV, macro, data quality) before strategy agent may propose TRADE.",
      expectedBenefit: "Fewer false-positive paper losses while preserving audit trail.",
      riskConcern: "May miss recovery if market regime flips.",
      requiredSampleSize: t.minSignalsForPaperOnly,
      testMode: "shadow_log",
      status: "DRAFT",
    });
  }

  if (ctx.scoreboard.totalResolved < t.minSignalsWatchlist) {
    proposals.push({
      id: proposalId(),
      title: "Resolve more paper outcomes before scaling",
      targetStrategy: "desk",
      problemObserved: `Only ${ctx.scoreboard.totalResolved} resolved sessions — council cannot promote strategies.`,
      proposedChange:
        "Run daily analyze + close paper positions; target 5+ resolved outcomes this week.",
      expectedBenefit: "Unlocks validation matrix and scale permission gates.",
      riskConcern: "Time cost; no guarantee of positive PnL.",
      requiredSampleSize: t.minSignalsWatchlist,
      testMode: "paper_only",
      status: "DRAFT",
    });
  }

  if (ctx.validation.killSwitch.tradingPaused) {
    proposals.push({
      id: proposalId(),
      title: "Cooldown discipline until kill switch clears",
      targetStrategy: "desk",
      problemObserved: "Kill switch or loss limits active on desk.",
      proposedChange:
        "Paper-only shadow mode: log would-be trades without opening new paper until cooldown ends.",
      expectedBenefit: "Protects mission capital curve from revenge trading patterns.",
      riskConcern: "Slower milestone progress during pause.",
      requiredSampleSize: 8,
      testMode: "shadow_log",
      status: "DRAFT",
    });
  }

  const regime = ctx.validation.currentRegime;
  const blocked = matrix.filter(
    (r) => r.status === "ACTIVE" && r.resolvedSignals > 0,
  );
  if (blocked.length > 0) {
    proposals.push({
      id: proposalId(),
      title: `Regime filter for ${regime}`,
      targetStrategy: "multi",
      problemObserved: `Current regime ${ctx.validation.currentRegimeLabel} may block some ACTIVE strategies.`,
      proposedChange:
        "Replay last 20 logs under current regime router rules; paper-test only allowed strategy IDs.",
      expectedBenefit: "Aligns desk TRADE rate with environment that actually has edge.",
      riskConcern: "Overfitting to recent regime label.",
      requiredSampleSize: 12,
      testMode: "replay_backtest",
      status: "DRAFT",
    });
  }

  const pendingAdaptation = ctx.adaptationProposals.filter(
    (p) => p.status === "PENDING" || p.status === "APPROVED",
  );

  const debate: CouncilAgentDebateRow = {
    agentName: "Strategy Optimizer Agent",
    role: "Improvement proposals (draft only)",
    stance: "support",
    statements: [
      `Generated ${proposals.length} DRAFT proposals — none touch live execution or hard rules.`,
      bestRow
        ? `Favor paper tests on ${bestRow.label} before any ACTIVE promotion.`
        : "Need more signals before optimization.",
      pendingAdaptation.length > 0
        ? `${pendingAdaptation.length} adaptation proposal(s) on /adaptation for operator review — council references only, cannot apply.`
        : "No adaptation proposals queued — run /adaptation analysis after more paper outcomes.",
      ctx.relevantMemory.lessons[1]
        ? `Memory graph lesson: ${ctx.relevantMemory.lessons[1].bullet}`
        : "Memory graph has no secondary lesson for this regime.",
      "Entry/exit filters must pass human draft-rule approval before committee use.",
      "Allocation changes defer to Capital Allocator Agent output.",
    ],
  };

  return { proposals, debate };
}
