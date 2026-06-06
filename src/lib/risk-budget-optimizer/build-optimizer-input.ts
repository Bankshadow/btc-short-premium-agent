import { buildUnifiedPortfolioSnapshot } from "@/lib/portfolio/build-unified-portfolio";
import { evaluateKillSwitch } from "@/lib/validation/kill-switch";
import { loadLivePilotRiskConfig } from "@/lib/live-pilot/pilot-config";
import type { AnalyzeApiResponse } from "@/lib/types/market";
import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import type { PaperOrder } from "@/lib/paper/paper-order-types";
import type { DeskRiskProfile } from "@/lib/desk/desk-risk-policy";
import type { PerpPaperPosition } from "@/lib/multi-asset/types";
import type { GovernanceAnalyzePayload } from "@/lib/governance/governance-types";
import type { RiskBudgetInput } from "./types";
import { getCachedCalibrationProfile } from "@/lib/confidence-calibration/calibration-cache";
import { resolveCalibrationSizeMultiplier } from "@/lib/confidence-calibration/apply-calibration";

export function buildRiskBudgetInput(input: {
  entries: DecisionLogEntry[];
  orders: PaperOrder[];
  perpPositions?: PerpPaperPosition[];
  riskProfile: DeskRiskProfile;
  analyze?: AnalyzeApiResponse | null;
  governance?: GovernanceAnalyzePayload | null;
}): RiskBudgetInput {
  const portfolio = buildUnifiedPortfolioSnapshot({
    entries: input.entries,
    orders: input.orders,
    perpPositions: input.perpPositions ?? [],
    riskProfile: input.riskProfile,
  });

  const analyze = input.analyze;
  const killSwitch = evaluateKillSwitch({
    entries: input.entries,
    orders: input.orders,
    riskProfile: input.riskProfile,
    latestAnalysis: analyze ?? undefined,
  });

  let pilotConfig = null;
  try {
    pilotConfig = loadLivePilotRiskConfig();
  } catch {
    pilotConfig = null;
  }

  const rawConfidence = analyze?.step5_verdict.confidence;
  const calibrationProfile = getCachedCalibrationProfile();

  return {
    portfolio,
    baseSizePct: analyze?.step6_actionPlan.suggestedSizePct ?? 2.5,
    currentEquity: portfolio.metrics.totalEquity,
    deskRiskProfile: input.riskProfile,
    regimeBrain: analyze?.tradingDesk?.regimeBrain ?? null,
    agentConfidence: rawConfidence,
    confidenceCalibrationMultiplier: resolveCalibrationSizeMultiplier(
      rawConfidence ?? 50,
      calibrationProfile,
    ),
    agentConflictLevel: analyze?.conflictAnalysis?.conflictLevel ?? "NONE",
    dataTrust: analyze?.dataTrust ?? null,
    conflictGate: analyze?.conflictGate ?? null,
    killSwitch,
    governance: input.governance ?? null,
    pilotConfig,
  };
}
