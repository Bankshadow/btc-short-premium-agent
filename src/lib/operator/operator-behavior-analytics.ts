import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import type { OperatorOverrideLogEntry } from "@/lib/governance/governance-types";
import type { OperatorBehaviorAnalytics } from "./types";

export function buildOperatorBehaviorAnalytics(input: {
  entries: DecisionLogEntry[];
  overrideLog: OperatorOverrideLogEntry[];
}): OperatorBehaviorAnalytics {
  const overrides = input.overrideLog;
  const overrideCount = overrides.length;

  let overrideWins = 0;
  let overrideResolved = 0;
  let overrideLossImpactR = 0;
  let afterLossStreak = 0;
  let aggressiveOverrides = 0;

  for (const o of overrides) {
    const entry = input.entries.find((e) => e.id === o.logEntryId);
    if (!entry?.resolution) continue;
    overrideResolved += 1;
    const win = entry.resolution.tradeWouldWin === true;
    if (win) overrideWins += 1;
    else overrideLossImpactR += Math.abs(entry.paperPnl ?? 0.5);

    const idx = input.entries.findIndex((e) => e.id === o.logEntryId);
    const prior = input.entries.slice(idx + 1, idx + 4);
    if (prior.filter((e) => e.paperPnl != null && e.paperPnl < 0).length >= 2) {
      afterLossStreak += 1;
    }
    if (entry.deskRiskProfile === "aggressive") aggressiveOverrides += 1;
  }

  const overrideWinRate =
    overrideResolved > 0 ? overrideWins / overrideResolved : 0;

  const rejectedAi = input.entries.filter(
    (e) =>
      e.operatorOverride &&
      e.finalVerdict === "TRADE" &&
      e.operatorOverride.disagreeWithVerdict !== "TRADE",
  ).length;

  const emotionalTradingWarnings: string[] = [];
  const recommendations: string[] = [];

  if (overrideCount >= 5) {
    emotionalTradingWarnings.push(
      `${overrideCount} operator overrides — discipline drift risk.`,
    );
    recommendations.push("Use 24h cooldown after 3 overrides in a week.");
  }
  if (afterLossStreak >= 2) {
    emotionalTradingWarnings.push("Overrides clustered after loss streaks.");
    recommendations.push("Mandatory pause before override after 2 losses.");
  }
  if (overrideWinRate < 0.35 && overrideResolved >= 3) {
    emotionalTradingWarnings.push("Override win rate below 35% — desk edge may be better.");
  }
  if (aggressiveOverrides >= 2) {
    emotionalTradingWarnings.push("Multiple overrides during aggressive profile.");
  }

  const bypassRisk = overrides.filter(
    (o) => o.riskVetoState && o.overriddenVerdict === "TRADE",
  ).length;
  if (bypassRisk > 0) {
    emotionalTradingWarnings.push(
      `${bypassRisk} override(s) bypassed Risk Manager veto — incident candidate.`,
    );
  }

  let score = 85;
  score -= overrideCount * 4;
  score -= afterLossStreak * 8;
  score -= bypassRisk * 15;
  if (overrideWinRate > 0.5) score += 5;
  score = Math.max(0, Math.min(100, score));

  return {
    operatorDisciplineScore: Math.round(score),
    overrideCount,
    overrideWinRate: Number((overrideWinRate * 100).toFixed(1)),
    overrideLossImpactR: Number(overrideLossImpactR.toFixed(2)),
    emotionalTradingWarnings,
    recommendations,
    overridesAfterLossStreak: afterLossStreak,
    overridesInAggressiveMode: aggressiveOverrides,
    rejectedAiTradeIdeas: rejectedAi,
    incidentCandidate: bypassRisk > 0 || overrideCount >= 8,
  };
}
