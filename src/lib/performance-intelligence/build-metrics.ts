import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import type { TradeEvaluationResult } from "@/lib/self-learning/types";
import type { OperatorOverrideLogEntry } from "@/lib/governance/governance-types";
import type { AdaptiveWeightingAuditEntry } from "@/lib/adaptive-agent-weighting/types";
import { buildAgentScoreboard } from "@/lib/journal/agent-scoreboard";
import { aggregateAgentLeaderboard } from "@/lib/self-learning/aggregate-agents";
import type {
  AgentContributionScore,
  CommitteeAccuracyReport,
  FalseSignalReport,
  HumanOverrideComparison,
  RiskManagerVetoQuality,
  WeightedCommitteeComparison,
} from "./types";

export function buildCommitteeAccuracy(
  entries: DecisionLogEntry[],
): CommitteeAccuracyReport {
  const resolved = entries.filter((e) => e.outcomeStatus === "RESOLVED");
  let correct = 0;
  let tradeCorrect = 0;
  let tradeTotal = 0;
  let skipCorrect = 0;
  let skipTotal = 0;
  let majorityWins = 0;

  for (const entry of resolved) {
    const win = entry.resolution?.tradeWouldWin;
    if (win === null || win === undefined) {
      if (entry.finalVerdict !== "TRADE") correct += 1;
      continue;
    }
    const verdictCorrect =
      (entry.finalVerdict === "TRADE" && win) ||
      (entry.finalVerdict === "SKIP" && !win) ||
      entry.finalVerdict === "WAIT";
    if (verdictCorrect) correct += 1;
    if (win) majorityWins += 1;

    if (entry.finalVerdict === "TRADE") {
      tradeTotal += 1;
      if (win) tradeCorrect += 1;
    }
    if (entry.finalVerdict === "SKIP") {
      skipTotal += 1;
      if (!win) skipCorrect += 1;
    }
  }

  return {
    totalResolved: resolved.length,
    correctVerdicts: correct,
    accuracyPct: resolved.length
      ? Number(((correct / resolved.length) * 100).toFixed(1))
      : 0,
    tradeCallAccuracy: tradeTotal
      ? Number(((tradeCorrect / tradeTotal) * 100).toFixed(1))
      : 0,
    skipCallAccuracy: skipTotal
      ? Number(((skipCorrect / skipTotal) * 100).toFixed(1))
      : 0,
    majorityAlignedWins: majorityWins,
  };
}

export function buildRiskManagerVetoQuality(
  entries: DecisionLogEntry[],
): RiskManagerVetoQuality {
  const vetoed = entries.filter(
    (e) => e.outcomeStatus === "RESOLVED" && e.riskVeto,
  );
  let correct = 0;
  let avoided = 0;
  let missed = 0;

  for (const entry of vetoed) {
    const win = entry.resolution?.tradeWouldWin;
    if (win === false) {
      correct += 1;
      avoided += Math.abs(entry.paperPnl ?? 0);
    } else if (win === true) {
      missed += 1;
    } else {
      correct += 1;
    }
  }

  return {
    totalVetoes: vetoed.length,
    correctVetoes: correct,
    accuracyPct: vetoed.length
      ? Number(((correct / vetoed.length) * 100).toFixed(1))
      : 0,
    avoidedLosses: Number(avoided.toFixed(2)),
    missedOpportunities: missed,
    notes:
      vetoed.length === 0
        ? ["No resolved risk vetoes in sample."]
        : [
            `${correct}/${vetoed.length} vetoes aligned with outcome.`,
            missed > 0 ? `${missed} veto(s) may have blocked winning trades.` : "",
          ].filter(Boolean),
  };
}

export function buildAgentContribution(
  entries: DecisionLogEntry[],
  evaluations: TradeEvaluationResult[],
): AgentContributionScore[] {
  const board = buildAgentScoreboard(entries);
  const leaderboard = aggregateAgentLeaderboard(evaluations);

  return board.agents.map((row) => {
    const evalRow = leaderboard.find((e) => e.agentName === row.agentName);
    const hitRate =
      evalRow?.prediction.hitRate ??
      (row.totalCalls > 0
        ? Math.round(
            ((row.correctTradeCalls + row.correctSkips) / row.totalCalls) * 100,
          )
        : 0);
    const regret = evalRow?.reasoning.regretScore ?? 0;
    const contributionScore = Number(
      (
        hitRate * 0.6 -
        row.falsePositives * 8 -
        row.falseNegatives * 5 -
        regret * 0.1
      ).toFixed(1),
    );

    const helpfulness: AgentContributionScore["helpfulness"] =
      contributionScore >= 50
        ? "HIGH"
        : contributionScore >= 25
          ? "MEDIUM"
          : "LOW";

    const notes: string[] = [];
    if (row.falsePositives >= 2) {
      notes.push(`${row.falsePositives} false TRADE calls`);
    }
    if (row.falseNegatives >= 2) {
      notes.push(`${row.falseNegatives} false SKIP calls`);
    }
    if (hitRate >= 60) notes.push("Strong historical accuracy");

    return {
      agentName: row.agentName,
      contributionScore,
      hitRate,
      falsePositives: row.falsePositives,
      falseNegatives: row.falseNegatives,
      avgRegretScore: regret,
      helpfulness,
      notes,
    };
  }).sort((a, b) => b.contributionScore - a.contributionScore);
}

export function buildFalseSignalReport(
  entries: DecisionLogEntry[],
  evaluations: TradeEvaluationResult[],
): FalseSignalReport {
  const resolved = entries.filter((e) => e.outcomeStatus === "RESOLVED");
  const falseTrades = resolved.filter((e) => e.falseTradeFlag).length;
  const falseSkips = resolved.filter((e) => e.falseSkipFlag).length;
  const opportunityCostR = resolved.reduce(
    (s, e) => s + (e.missedOpportunityR ?? 0),
    0,
  );
  const avoidedLossR = resolved.reduce(
    (s, e) => s + (e.avoidedLossR ?? 0),
    0,
  );

  const regrets = evaluations.flatMap((ev) =>
    ev.agentEvaluations.map((a) => a.reasoning.regretScore),
  );
  const avgRegret =
    regrets.length > 0
      ? Number((regrets.reduce((s, v) => s + v, 0) / regrets.length).toFixed(2))
      : 0;

  const board = buildAgentScoreboard(entries);
  const topFalseTradeAgents = [...board.agents]
    .sort((a, b) => b.falsePositives - a.falsePositives)
    .filter((a) => a.falsePositives > 0)
    .slice(0, 3)
    .map((a) => a.agentName);
  const topFalseSkipAgents = [...board.agents]
    .sort((a, b) => b.falseNegatives - a.falseNegatives)
    .filter((a) => a.falseNegatives > 0)
    .slice(0, 3)
    .map((a) => a.agentName);

  const examples = resolved
    .filter((e) => e.falseTradeFlag || e.falseSkipFlag)
    .slice(0, 8)
    .map((e) => ({
      decisionLogId: e.id,
      timestamp: e.timestamp,
      type: e.falseTradeFlag ? ("FALSE_TRADE" as const) : ("FALSE_SKIP" as const),
      pnlPct: e.paperPnl ?? 0,
      regime: e.marketRegime,
    }));

  return {
    falseTrades,
    falseSkips,
    opportunityCostR: Number(opportunityCostR.toFixed(2)),
    avoidedLossR: Number(avoidedLossR.toFixed(2)),
    avgRegretScore: avgRegret,
    topFalseTradeAgents,
    topFalseSkipAgents,
    examples,
  };
}

export function buildWeightedCommitteeComparison(
  audit: AdaptiveWeightingAuditEntry[],
): WeightedCommitteeComparison {
  if (audit.length === 0) {
    return {
      totalComparisons: 0,
      verdictDiffers: 0,
      weightedWouldImprove: 0,
      weightedWouldWorsen: 0,
      avgDisagreementScore: 0,
      summary: "No adaptive weighting audit entries yet.",
    };
  }

  const differs = audit.filter((a) => a.verdictDiffers);
  const avgDisagreement =
    audit.reduce((s, a) => s + a.disagreementScore, 0) / audit.length;

  return {
    totalComparisons: audit.length,
    verdictDiffers: differs.length,
    weightedWouldImprove: differs.filter(
      (a) => a.weightedVerdict === "SKIP" && a.originalVerdict === "TRADE",
    ).length,
    weightedWouldWorsen: differs.filter(
      (a) => a.weightedVerdict === "TRADE" && a.originalVerdict === "SKIP",
    ).length,
    avgDisagreementScore: Number(avgDisagreement.toFixed(3)),
    summary: `${differs.length}/${audit.length} weighted verdicts differed from majority.`,
  };
}

export function buildHumanOverrideComparison(
  entries: DecisionLogEntry[],
  overrideLog: OperatorOverrideLogEntry[],
): HumanOverrideComparison {
  if (overrideLog.length === 0) {
    return {
      totalOverrides: 0,
      overrideWasCorrect: 0,
      aiWasCorrect: 0,
      accuracyPct: 0,
      summary: "No operator overrides logged.",
    };
  }

  let overrideCorrect = 0;
  let aiCorrect = 0;

  for (const ov of overrideLog) {
    const entry = entries.find((e) => e.id === ov.logEntryId);
    if (!entry || entry.outcomeStatus !== "RESOLVED") continue;
    const win = entry.resolution?.tradeWouldWin;
    if (win === null || win === undefined) continue;

    const aiRight =
      (entry.finalVerdict === "TRADE" && win) ||
      (entry.finalVerdict === "SKIP" && !win);
    const overrideRight =
      (ov.overriddenVerdict === "TRADE" && win) ||
      (ov.overriddenVerdict === "SKIP" && !win);

    if (aiRight) aiCorrect += 1;
    if (overrideRight) overrideCorrect += 1;
  }

  const total = overrideLog.length;
  return {
    totalOverrides: total,
    overrideWasCorrect: overrideCorrect,
    aiWasCorrect: aiCorrect,
    accuracyPct: total
      ? Number(((overrideCorrect / total) * 100).toFixed(1))
      : 0,
    summary: `Operator override correct ${overrideCorrect}/${total} vs AI ${aiCorrect}/${total}.`,
  };
}
