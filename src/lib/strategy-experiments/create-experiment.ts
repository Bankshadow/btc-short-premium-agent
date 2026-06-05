import type { StrategyId } from "@/lib/validation/validation-types";
import {
  EXPERIMENT_LABEL_PREFIX,
  EXPERIMENT_SAFETY_NOTICE,
  type CreateExperimentInput,
  type StrategyExperiment,
  type StrategyVariant,
} from "./types";

function experimentId(): string {
  return `exp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function defaultVariant(targetStrategy: StrategyId = "options_short_premium"): StrategyVariant {
  return {
    targetStrategy,
    modifiedRules: [],
    targetRegime: "",
    targetAsset: "BTCUSDT",
    entryCondition: "Align with committee TRADE when risk veto clear",
    exitCondition: "Close on committee SKIP or risk veto",
    sizingRule: "Use committee suggested size — experiment does not override",
    riskLimits: ["Respect risk veto", "Max loss 3% daily budget"],
    successCriteria: {
      success: "Win rate >= 50% over 3+ shadow TRADE signals with positive net PnL",
      failure: "Win rate < 35% or net PnL < -2% over 2+ samples",
      minWinRate: 50,
      minSampleSize: 3,
      minNetPnlPct: 0,
    },
    failureCriteria: {
      success: "",
      failure: "Consistent losses in shadow replay",
      minSampleSize: 2,
    },
  };
}

export function createStrategyExperiment(
  input: CreateExperimentInput,
): StrategyExperiment {
  const now = new Date().toISOString();
  const label = `${EXPERIMENT_LABEL_PREFIX} ${input.hypothesis.summary.slice(0, 60)}`;

  return {
    experimentId: experimentId(),
    label,
    source: input.source,
    sourceRef: input.sourceRef ?? "",
    mode: input.mode ?? "historical_replay",
    status: "draft",
    hypothesis: input.hypothesis,
    variant: input.variant,
    openPaperPositions: input.openPaperPositions ?? false,
    result: null,
    shadowTrades: [],
    promotionProposal: null,
    createdAt: now,
    updatedAt: now,
    safetyLabel: EXPERIMENT_SAFETY_NOTICE,
    cannotPlaceLiveTrades: true,
    isolatedFromProduction: true,
  };
}
