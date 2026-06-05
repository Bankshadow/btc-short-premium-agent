import type { StrategyId } from "@/lib/validation/validation-types";
import type { StrategySkill } from "@/lib/strategy-registry/strategy-registry-types";
import {
  nextDemoteStatus,
  nextPromoteStatus,
} from "@/lib/strategy-registry/strategy-registry-status";
import type {
  AdaptationPerformanceReport,
  AdaptationProposalType,
  StrategyAdaptationProposal,
  StrategyPerformanceSlice,
} from "./types";

function newProposalId(): string {
  return `adapt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function baseProposal(
  type: AdaptationProposalType,
  target: StrategyId,
  skill: StrategySkill | undefined,
  slice: StrategyPerformanceSlice,
  reason: string,
  expected: string,
  confidence: number,
  risk: "LOW" | "MEDIUM" | "HIGH",
  proposedStatus: StrategySkill["status"] | null,
): StrategyAdaptationProposal {
  return {
    proposalId: newProposalId(),
    type,
    targetStrategy: target,
    reason,
    supportingStats: {
      winRate: slice.winRate,
      avgPnlPct: slice.avgPnlPct,
      maxDrawdownPct: slice.maxDrawdownPct,
      sampleSize: slice.sampleSize,
    },
    riskImpact: risk,
    confidence,
    expectedBehaviorChange: expected,
    humanApprovalRequired: true,
    status: "PENDING",
    createdAt: new Date().toISOString(),
    reviewedAt: null,
    appliedAt: null,
    reviewerNote: null,
    editedReason: null,
    previousRegistryStatus: skill?.status ?? slice.currentStatus,
    proposedRegistryStatus: proposedStatus,
  };
}

export function generateAdaptationProposals(
  report: AdaptationPerformanceReport,
  registry: { strategies: StrategySkill[] },
): StrategyAdaptationProposal[] {
  const proposals: StrategyAdaptationProposal[] = [];
  const skillById = new Map(registry.strategies.map((s) => [s.id, s]));

  for (const slice of report.strategyPerformance) {
    const skill = skillById.get(slice.strategyId);
    const status = skill?.status ?? slice.currentStatus;

    if (slice.sampleSize < 3) {
      proposals.push(
        baseProposal(
          "REVIEW_ONLY",
          slice.strategyId,
          skill,
          slice,
          `Only ${slice.sampleSize} resolved samples — gather more paper outcomes before registry change.`,
          "No registry change; continue paper logging.",
          40,
          "LOW",
          null,
        ),
      );
      continue;
    }

    if (
      slice.winRate >= 55 &&
      slice.avgPnlPct > 0 &&
      slice.sampleSize >= 5 &&
      (status === "WATCHLIST" || status === "PAPER_TESTING" || status === "DRAFT")
    ) {
      const next = nextPromoteStatus(status);
      if (next) {
        proposals.push(
          baseProposal(
            "PROMOTE",
            slice.strategyId,
            skill,
            slice,
            `Win rate ${slice.winRate}% over ${slice.sampleSize} samples with positive avg PnL — promote for more paper testing.`,
            `${status} → ${next}; committee may propose TRADE more often in paper.`,
            Math.min(90, 50 + slice.sampleSize * 2),
            "LOW",
            next,
          ),
        );
      }
    }

    if (
      slice.winRate < 40 &&
      slice.sampleSize >= 3 &&
      (status === "ACTIVE" || status === "PAPER_TESTING")
    ) {
      const next = nextDemoteStatus(status) ?? "WATCHLIST";
      proposals.push(
        baseProposal(
          "DEMOTE",
          slice.strategyId,
          skill,
          slice,
          `Win rate ${slice.winRate}% below desk floor — demote to reduce paper exposure.`,
          `${status} → ${next}; strategy agent blocked from TRADE when DISABLED/DEPRECATED gates apply.`,
          65,
          "MEDIUM",
          next,
        ),
      );
    }

    if (slice.maxDrawdownPct >= 8 && slice.sampleSize >= 4) {
      proposals.push(
        baseProposal(
          "TIGHTEN_RULE",
          slice.strategyId,
          skill,
          slice,
          `Max drawdown ${slice.maxDrawdownPct}% on ${slice.label} — tighten draft rules or reduce size.`,
          "Link stricter draft rule; no live risk increase.",
          60,
          "MEDIUM",
          status,
        ),
      );
    }
  }

  for (const pattern of report.failurePatterns) {
    if (pattern.strategies.length === 0) continue;
    const sid = pattern.strategies[0];
    const skill = skillById.get(sid);
    const slice = report.strategyPerformance.find((s) => s.strategyId === sid);
    if (!slice || skill?.status === "DISABLED") continue;

    proposals.push(
      baseProposal(
        "PAUSE",
        sid,
        skill,
        slice,
        `Failure pattern: ${pattern.pattern}`,
        "Pause strategy (DISABLED) until operator review — reversible.",
        70,
        "HIGH",
        "DISABLED",
      ),
    );
  }

  const { strict, relaxed } = report.strictVsRelaxed;
  if (
    relaxed.trades >= 3 &&
    relaxed.winRate > strict.winRate + 10 &&
    relaxed.avgPnlPct > strict.avgPnlPct
  ) {
    const slice = report.strategyPerformance.find(
      (s) => s.strategyId === "options_short_premium",
    );
    if (slice) {
      proposals.push(
        baseProposal(
          "RELAX_RULE",
          "options_short_premium",
          skillById.get("options_short_premium"),
          slice,
          `Relaxed paper outperforms strict (${relaxed.winRate}% vs ${strict.winRate}% win) — review paper gates only.`,
          "Advisory to keep RELAXED_PAPER mode; does not enable live execution.",
          55,
          "LOW",
          slice.currentStatus,
        ),
      );
    }
  }

  const bt = report.historicalBacktest;
  if (bt && bt.sessionsReplayed >= 5) {
    const slice = report.strategyPerformance[0];
    if (slice && bt.falseTradeCount >= 2) {
      proposals.push(
        baseProposal(
          "TIGHTEN_RULE",
          slice.strategyId,
          skillById.get(slice.strategyId),
          slice,
          `Historical backtest (simulation) flagged ${bt.falseTradeCount} false TRADEs over ${bt.sessionsReplayed} sessions — human review required.`,
          "Tighten entry gates; backtest cannot auto-apply changes.",
          62,
          "MEDIUM",
          slice.currentStatus,
        ),
      );
    } else if (slice && bt.totalReturnPct > 5 && bt.winRate >= 55) {
      proposals.push(
        baseProposal(
          "REVIEW_ONLY",
          slice.strategyId,
          skillById.get(slice.strategyId),
          slice,
          `Backtest simulation positive (+${bt.totalReturnPct}% return, ${bt.winRate}% win) — supports promotion review only.`,
          "No auto-promotion; operator must approve on /adaptation.",
          50,
          "LOW",
          null,
        ),
      );
    }
  }

  const deduped = new Map<string, StrategyAdaptationProposal>();
  for (const p of proposals) {
    const key = `${p.type}-${p.targetStrategy}`;
    const existing = deduped.get(key);
    if (!existing || p.confidence > existing.confidence) {
      deduped.set(key, p);
    }
  }

  return [...deduped.values()].sort((a, b) => b.confidence - a.confidence);
}
