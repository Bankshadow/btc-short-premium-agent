import type { CouncilProposal } from "@/lib/council/types";
import type { AutoDiscoveredRuleProposal } from "@/lib/rule-discovery/types";
import type { ImprovementRecommendation } from "@/lib/self-learning/types";
import type { RelevantMemoryLesson } from "@/lib/memory-graph/types";
import type { StrategyId } from "@/lib/validation/validation-types";
import { createStrategyExperiment, defaultVariant } from "./create-experiment";
import type { CreateExperimentInput, StrategyExperiment } from "./types";

function councilMode(
  testMode: CouncilProposal["testMode"],
): CreateExperimentInput["mode"] {
  if (testMode === "replay_backtest") return "historical_replay";
  if (testMode === "shadow_log") return "forward_paper_shadow";
  return "strict_paper";
}

export function experimentFromCouncilProposal(
  proposal: CouncilProposal,
): StrategyExperiment {
  const target =
    proposal.targetStrategy === "desk" || proposal.targetStrategy === "multi"
      ? "options_short_premium"
      : proposal.targetStrategy;

  const variant = defaultVariant(target as StrategyId);
  variant.modifiedRules = proposal.linkedDraftRuleHint
    ? [proposal.linkedDraftRuleHint]
    : [proposal.proposedChange];
  variant.entryCondition = proposal.proposedChange;
  variant.exitCondition = "Revert on risk veto or committee SKIP";

  return createStrategyExperiment({
    source: "council_proposal",
    sourceRef: proposal.id,
    mode: councilMode(proposal.testMode),
    hypothesis: {
      summary: proposal.title,
      expectedOutcome: proposal.expectedBenefit,
      sourceRef: proposal.id,
    },
    variant,
    openPaperPositions: false,
  });
}

export function experimentFromRuleDiscovery(
  rule: AutoDiscoveredRuleProposal,
): StrategyExperiment {
  const target = rule.suggestedScope.strategyId ?? "options_short_premium";
  const variant = defaultVariant(target);
  variant.modifiedRules = [rule.condition, ...rule.supportingTrades.map(() => rule.rationale)].slice(0, 3);
  variant.targetRegime = rule.suggestedScope.regime ?? "";
  variant.entryCondition = rule.condition;
  variant.successCriteria.minSampleSize = 2;

  const mode =
    rule.ruleType === "ALLOW_PAPER" ? "relaxed_paper" : "historical_replay";

  return createStrategyExperiment({
    source: "rule_discovery",
    sourceRef: rule.ruleId,
    mode,
    hypothesis: {
      summary: rule.title,
      expectedOutcome: rule.rationale,
      sourceRef: rule.ruleId,
    },
    variant,
    openPaperPositions: false,
  });
}

export function experimentFromSelfLearning(
  rec: ImprovementRecommendation,
): StrategyExperiment | null {
  if (rec.target !== "strategy" && rec.target !== "agent") return null;
  const target =
    rec.target === "strategy" && rec.targetId !== "desk"
      ? (rec.targetId as StrategyId)
      : "options_short_premium";

  const variant = defaultVariant(target);
  variant.modifiedRules = [rec.suggestedAction];
  variant.entryCondition = rec.suggestedAction;

  return createStrategyExperiment({
    source: "self_learning",
    sourceRef: rec.id,
    mode: "historical_replay",
    hypothesis: {
      summary: rec.title,
      expectedOutcome: rec.problem,
      sourceRef: rec.id,
    },
    variant,
  });
}

export function experimentFromMemoryLesson(
  lesson: RelevantMemoryLesson,
): StrategyExperiment {
  const variant = defaultVariant("options_short_premium");
  variant.modifiedRules = [lesson.bullet];
  variant.entryCondition = lesson.bullet;

  return createStrategyExperiment({
    source: "memory_graph",
    sourceRef: lesson.nodeIds.join(","),
    mode: "forward_paper_shadow",
    hypothesis: {
      summary: lesson.bullet.slice(0, 80),
      expectedOutcome: lesson.whyUsed,
    },
    variant,
  });
}

export function experimentFromUserHypothesis(input: {
  summary: string;
  expectedOutcome: string;
  variant?: Partial<import("./types").StrategyVariant>;
  mode?: CreateExperimentInput["mode"];
}): StrategyExperiment {
  const variant = { ...defaultVariant(), ...input.variant };
  return createStrategyExperiment({
    source: "user_hypothesis",
    sourceRef: "user",
    mode: input.mode ?? "historical_replay",
    hypothesis: {
      summary: input.summary,
      expectedOutcome: input.expectedOutcome,
    },
    variant,
  });
}
