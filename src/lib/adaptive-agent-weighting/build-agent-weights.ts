import type { AgentEvaluation } from "@/lib/self-learning/types";
import type { RelevantMemoryResult } from "@/lib/memory-graph/types";
import type {
  AdaptiveWeightingSettings,
  AgentWeightEntry,
  AgentWeightProfile,
} from "./types";

const VOTING_AGENTS = new Set([
  "Bull Thesis Agent",
  "Bear Thesis Agent",
  "Spot Strategy Agent",
  "Futures Strategy Agent",
  "Options Strategy Agent",
  "Data Quality Agent",
  "Macro & News Agent",
]);

function sliceAccuracy(
  slices: { label: string; hitRate: number; sampleSize: number }[],
  label: string,
): number {
  const match = slices.find((s) =>
    s.label.toLowerCase().includes(label.toLowerCase().slice(0, 8)),
  );
  if (!match || match.sampleSize < 1) return 50;
  return match.hitRate;
}

export function buildAgentWeightProfile(input: {
  settings: AdaptiveWeightingSettings;
  marketRegime: string;
  targetAsset: string;
  targetStrategy: string;
  agentEvaluations: AgentEvaluation[];
  relevantMemory?: RelevantMemoryResult;
  totalResolvedSamples: number;
}): AgentWeightProfile {
  const { settings, marketRegime, targetAsset, targetStrategy, agentEvaluations } =
    input;
  const evalMap = new Map(agentEvaluations.map((e) => [e.agentName, e]));

  const entries: AgentWeightEntry[] = [];

  for (const agentName of VOTING_AGENTS) {
    const ev = evalMap.get(agentName);
    const baseWeight = 1;
    const historicalAccuracy = ev?.prediction.hitRate ?? 50;
    const regimeAccuracy = ev
      ? sliceAccuracy(ev.byRegime, marketRegime)
      : 50;
    const strategyAccuracy = ev
      ? sliceAccuracy(ev.byStrategy, targetStrategy)
      : 50;
    const assetAccuracy = ev
      ? sliceAccuracy(ev.byAsset, targetAsset)
      : 50;
    const calibrationScore = ev
      ? Math.round((1 - ev.reasoning.confidenceCalibrationError) * 100)
      : 50;
    const fpPenalty = (ev?.prediction.falsePositives ?? 0) * 0.12;
    const fnPenalty = (ev?.prediction.falseNegatives ?? 0) * 0.08;
    const riskUsefulness = ev?.reasoning.riskWarningUsefulness ?? 50;
    const recentDecay =
      ev && ev.prediction.totalCalls < settings.recentPerformanceLookback
        ? 0.9
        : 1;

    const trustedReasons: string[] = [];
    const downweightedReasons: string[] = [];

    if (historicalAccuracy >= 60) {
      trustedReasons.push(`Historical hit rate ${historicalAccuracy}%`);
    } else if (historicalAccuracy < 45 && (ev?.prediction.totalCalls ?? 0) >= 2) {
      downweightedReasons.push(`Low historical hit rate ${historicalAccuracy}%`);
    }

    if (regimeAccuracy >= 55) {
      trustedReasons.push(`Regime ${marketRegime}: ${regimeAccuracy}% accuracy`);
    } else if (regimeAccuracy < 40) {
      downweightedReasons.push(`Weak in ${marketRegime} (${regimeAccuracy}%)`);
    }

    if (strategyAccuracy >= 55) {
      trustedReasons.push(`Strategy context: ${strategyAccuracy}%`);
    }
    if (assetAccuracy >= 55) {
      trustedReasons.push(`${targetAsset} accuracy: ${assetAccuracy}%`);
    } else if (assetAccuracy < 40 && (ev?.prediction.totalCalls ?? 0) >= 2) {
      downweightedReasons.push(`Weak on ${targetAsset} (${assetAccuracy}%)`);
    }

    if ((ev?.prediction.falsePositives ?? 0) >= 2) {
      downweightedReasons.push(
        `${ev!.prediction.falsePositives} false-positive TRADE calls`,
      );
    }
    if ((ev?.prediction.falseNegatives ?? 0) >= 2) {
      downweightedReasons.push(
        `${ev!.prediction.falseNegatives} missed wins (false SKIP)`,
      );
    }

    if (calibrationScore < 40) {
      downweightedReasons.push(`Poor confidence calibration (${calibrationScore}%)`);
    } else if (calibrationScore >= 70) {
      trustedReasons.push("Well-calibrated confidence");
    }

    const overconfident = (ev?.reasoning.confidenceCalibrationError ?? 0) >= 0.35;
    if (overconfident) {
      downweightedReasons.push("Overconfident agent — reduced trust (MVP 83)");
    }

    const memoryBoost = (input.relevantMemory?.lessons ?? []).some((l) =>
      l.bullet.toLowerCase().includes(agentName.split(" ")[0].toLowerCase()),
    );
    if (memoryBoost) {
      trustedReasons.push("Memory graph lesson supports agent");
    }

    let weight =
      baseWeight *
      (0.4 + historicalAccuracy / 100) *
      (0.7 + regimeAccuracy / 200) *
      (0.8 + strategyAccuracy / 250) *
      (0.85 + assetAccuracy / 300) *
      recentDecay;
    weight *= 1 - fpPenalty - fnPenalty;
    weight *= 0.8 + calibrationScore / 250;
    if (calibrationScore < 40) weight *= 0.82;
    if (overconfident) weight *= 0.75;
    if (agentName === "Risk Manager Agent") {
      weight *= 0.5 + riskUsefulness / 200;
    }

    weight = Math.max(
      0.25,
      Math.min(settings.maxWeightMultiplier, Number(weight.toFixed(3))),
    );

    entries.push({
      agentName,
      weight,
      baseWeight,
      historicalAccuracy,
      regimeAccuracy,
      strategyAccuracy,
      assetAccuracy,
      calibrationScore,
      falsePositivePenalty: fpPenalty,
      falseNegativePenalty: fnPenalty,
      riskUsefulness,
      recentDecay,
      trustedReasons,
      downweightedReasons,
    });
  }

  return {
    generatedAt: new Date().toISOString(),
    marketRegime,
    targetAsset,
    targetStrategy,
    entries: entries.sort((a, b) => b.weight - a.weight),
    totalResolvedSamples: input.totalResolvedSamples,
    weightingEnabled: settings.adaptiveWeightingEnabled,
    paperOnlyMode: settings.paperOnlyAdaptiveMode,
  };
}
