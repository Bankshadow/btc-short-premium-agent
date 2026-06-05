import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import type { PaperOrder } from "@/lib/paper/paper-order-types";
import type { DeskRiskProfile } from "@/lib/desk/desk-risk-policy";
import type { PerpPaperPosition } from "@/lib/multi-asset/types";
import type { UnifiedPortfolioSnapshot } from "@/lib/portfolio/unified-types";
import { buildStrategyRegistry } from "@/lib/strategy-registry/build-strategy-registry";
import type { StrategyRegistrySnapshot } from "@/lib/strategy-registry/strategy-registry-types";
import { analyzeAdaptationPerformance } from "./analyze-performance";
import { generateAdaptationProposals } from "./generate-proposals";
import type { AdaptationAnalysisResult } from "./types";

export const ADAPTATION_SAFETY_NOTICE =
  "All adaptation proposals require human approval. No auto-apply. No live execution. No max live risk increase. Changes are reversible via audit log.";

export function runAdaptationAnalysis(input: {
  entries: DecisionLogEntry[];
  orders: PaperOrder[];
  perpPositions?: PerpPaperPosition[];
  riskProfile: DeskRiskProfile;
  registry?: StrategyRegistrySnapshot;
  portfolio?: UnifiedPortfolioSnapshot;
  historicalBacktest?: import("@/lib/historical-backtest/types").BacktestAdaptationBridge | null;
}): AdaptationAnalysisResult {
  const registry =
    input.registry ??
    buildStrategyRegistry({
      entries: input.entries,
      orders: input.orders,
      riskProfile: input.riskProfile,
    });

  const report = analyzeAdaptationPerformance({
    ...input,
    registry,
    historicalBacktest: input.historicalBacktest ?? null,
  });

  const proposals = generateAdaptationProposals(report, registry);

  return {
    report,
    proposals,
    safetyNotice: ADAPTATION_SAFETY_NOTICE,
  };
}
