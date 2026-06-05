import { evaluateDemotionTriggers, resolveAutoDemotion } from "./evaluate-demotion";
import { evaluatePromotionEligibility } from "./evaluate-promotion";
import { computeLivePerformance, performanceByStage } from "./performance-metrics";
import { getStageDefinition, nextStage } from "./stage-definitions";
import type { ScaleUpInput, ScaleUpReport } from "./types";
import { LIVE_SCALE_UP_SAFETY_NOTICE } from "./types";

export function buildScaleUpReport(input: ScaleUpInput): ScaleUpReport {
  const currentDef = getStageDefinition(input.currentStage);
  const performance = computeLivePerformance(input.journal, input.incidents);
  const promotion = evaluatePromotionEligibility(input);
  const demotionTriggers = evaluateDemotionTriggers(input);
  const auto = resolveAutoDemotion(input);

  return {
    generatedAt: new Date().toISOString(),
    currentStage: input.currentStage,
    currentStageDefinition: currentDef,
    nextStage: nextStage(input.currentStage),
    tradingAllowed:
      currentDef.tradingEnabled &&
      !input.emergencyStopActive &&
      !input.realTimeRisk.blockNewTrades &&
      input.currentStage !== "LIVE_STAGE_0_DISABLED",
    promotion,
    demotionTriggers,
    shouldAutoDemote: auto.shouldAutoDemote,
    autoDemoteTarget: auto.targetStage,
    autoDemoteReasons: auto.reasons,
    performance,
    performanceByStage: performanceByStage(input.journal),
    approvalHistory: input.approvalHistory ?? [],
    safetyNotice: LIVE_SCALE_UP_SAFETY_NOTICE,
    cannotAutoPromote: true,
    btcOptionsExcluded: true,
  };
}
