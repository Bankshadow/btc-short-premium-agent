import type {
  AgentEvaluation,
  AgentPredictionScore,
  AgentReasoningScore,
  ContextPerformanceSlice,
  TradeEvaluationResult,
} from "./types";
import { gradeFromHitRate } from "./confidence";
import { CORE_EVALUATION_AGENTS, COMMITTEE_AGENT_NAME } from "./types";

function emptyPrediction(): AgentPredictionScore {
  return {
    hitRate: 0,
    avgPnlAfterTradeRec: 0,
    avoidedLossAfterSkip: 0,
    opportunityCostWrongSkip: 0,
    lossFromWrongTrade: 0,
    falsePositives: 0,
    falseNegatives: 0,
    correctTradeCalls: 0,
    correctSkips: 0,
    totalCalls: 0,
  };
}

function mergeSlices(
  existing: ContextPerformanceSlice[],
  incoming: ContextPerformanceSlice[],
): ContextPerformanceSlice[] {
  const map = new Map<string, { hits: number; n: number; pnl: number }>();
  for (const slice of [...existing, ...incoming]) {
    const stat = map.get(slice.label) ?? { hits: 0, n: 0, pnl: 0 };
    stat.n += slice.sampleSize;
    stat.hits += (slice.hitRate / 100) * slice.sampleSize;
    stat.pnl += slice.avgPnlPct * slice.sampleSize;
    map.set(slice.label, stat);
  }
  return [...map.entries()].map(([label, stat]) => ({
    label,
    sampleSize: stat.n,
    hitRate: stat.n > 0 ? Math.round((stat.hits / stat.n) * 100) : 0,
    avgPnlPct: stat.n > 0 ? Number((stat.pnl / stat.n).toFixed(2)) : 0,
  }));
}

function mergeAgentEvaluations(
  base: AgentEvaluation,
  incoming: AgentEvaluation,
): AgentEvaluation {
  const p = base.prediction;
  const ip = incoming.prediction;
  const totalCalls = p.totalCalls + ip.totalCalls;
  const hits = p.correctTradeCalls + p.correctSkips + ip.correctTradeCalls + ip.correctSkips;
  const tradeRecCount =
    p.correctTradeCalls + p.falsePositives + ip.correctTradeCalls + ip.falsePositives;
  const skipRecCount =
    p.correctSkips + p.falseNegatives + ip.correctSkips + ip.falseNegatives;

  const prediction: AgentPredictionScore = {
    hitRate: totalCalls > 0 ? Math.round((hits / totalCalls) * 100) : 0,
    avgPnlAfterTradeRec:
      tradeRecCount > 0
        ? Number(
            (
              (p.avgPnlAfterTradeRec * (p.correctTradeCalls + p.falsePositives) +
                ip.avgPnlAfterTradeRec *
                  (ip.correctTradeCalls + ip.falsePositives)) /
              tradeRecCount
            ).toFixed(2),
          )
        : 0,
    avoidedLossAfterSkip: Number(
      (p.avoidedLossAfterSkip + ip.avoidedLossAfterSkip).toFixed(2),
    ),
    opportunityCostWrongSkip: Number(
      (p.opportunityCostWrongSkip + ip.opportunityCostWrongSkip).toFixed(2),
    ),
    lossFromWrongTrade: Number((p.lossFromWrongTrade + ip.lossFromWrongTrade).toFixed(2)),
    falsePositives: p.falsePositives + ip.falsePositives,
    falseNegatives: p.falseNegatives + ip.falseNegatives,
    correctTradeCalls: p.correctTradeCalls + ip.correctTradeCalls,
    correctSkips: p.correctSkips + ip.correctSkips,
    totalCalls,
  };

  const reasoning: AgentReasoningScore = {
    riskWarningUsefulness: Math.round(
      (base.reasoning.riskWarningUsefulness + incoming.reasoning.riskWarningUsefulness) / 2,
    ),
    missedRiskFactors: [
      ...new Set([
        ...base.reasoning.missedRiskFactors,
        ...incoming.reasoning.missedRiskFactors,
      ]),
    ].slice(0, 8),
    reasoningQuality: Math.round(
      (base.reasoning.reasoningQuality + incoming.reasoning.reasoningQuality) / 2,
    ),
    confidenceCalibrationError: Number(
      (
        (base.reasoning.confidenceCalibrationError +
          incoming.reasoning.confidenceCalibrationError) /
        2
      ).toFixed(3),
    ),
    regretScore: Number(
      ((base.reasoning.regretScore + incoming.reasoning.regretScore) / 2).toFixed(1),
    ),
  };

  const helpingScore = Number(
    (
      (base.helpingScore * base.prediction.totalCalls +
        incoming.helpingScore * incoming.prediction.totalCalls) /
      totalCalls
    ).toFixed(2),
  );

  let vetoQuality = base.vetoQuality;
  if (incoming.vetoQuality != null) {
    vetoQuality =
      vetoQuality != null
        ? Math.round((vetoQuality + incoming.vetoQuality) / 2)
        : incoming.vetoQuality;
  }

  return {
    agentName: base.agentName,
    prediction,
    reasoning,
    contributionToVerdict: Number(
      (
        (base.contributionToVerdict * base.prediction.totalCalls +
          incoming.contributionToVerdict * incoming.prediction.totalCalls) /
        totalCalls
      ).toFixed(2),
    ),
    vetoQuality,
    byRegime: mergeSlices(base.byRegime, incoming.byRegime),
    byAsset: mergeSlices(base.byAsset, incoming.byAsset),
    byStrategy: mergeSlices(base.byStrategy, incoming.byStrategy),
    overallGrade: gradeFromHitRate(prediction.hitRate, totalCalls),
    helpingScore,
  };
}

export function aggregateAgentLeaderboard(
  results: TradeEvaluationResult[],
): AgentEvaluation[] {
  const map = new Map<string, AgentEvaluation>();

  for (const result of results) {
    const all = [...result.agentEvaluations, result.committeeEvaluation];
    for (const ev of all) {
      const existing = map.get(ev.agentName);
      if (!existing) {
        map.set(ev.agentName, ev);
      } else {
        map.set(ev.agentName, mergeAgentEvaluations(existing, ev));
      }
    }
  }

  const order = new Map<string, number>();
  [...CORE_EVALUATION_AGENTS, COMMITTEE_AGENT_NAME].forEach((name, i) => {
    order.set(name, i);
  });

  return [...map.values()].sort((a, b) => {
    if (b.helpingScore !== a.helpingScore) return b.helpingScore - a.helpingScore;
    return (order.get(a.agentName) ?? 99) - (order.get(b.agentName) ?? 99);
  });
}

export function extractAgentWeaknesses(
  leaderboard: AgentEvaluation[],
): Array<{
  agentName: string;
  weakness: string;
  evidence: string;
  severity: "low" | "medium" | "high";
}> {
  const weaknesses: Array<{
    agentName: string;
    weakness: string;
    evidence: string;
    severity: "low" | "medium" | "high";
  }> = [];

  for (const agent of leaderboard) {
    const { prediction, reasoning } = agent;
    if (prediction.falsePositives >= 2) {
      weaknesses.push({
        agentName: agent.agentName,
        weakness: "False-positive TRADE bias",
        evidence: `${prediction.falsePositives} false positives over ${prediction.totalCalls} calls`,
        severity: prediction.falsePositives >= 4 ? "high" : "medium",
      });
    }
    if (prediction.falseNegatives >= 2) {
      weaknesses.push({
        agentName: agent.agentName,
        weakness: "Over-cautious SKIP bias",
        evidence: `${prediction.falseNegatives} missed wins · opportunity cost ${prediction.opportunityCostWrongSkip}%`,
        severity: prediction.falseNegatives >= 4 ? "high" : "medium",
      });
    }
    if (reasoning.confidenceCalibrationError > 0.35) {
      weaknesses.push({
        agentName: agent.agentName,
        weakness: "Poor confidence calibration",
        evidence: `Calibration error ${reasoning.confidenceCalibrationError}`,
        severity: "medium",
      });
    }
    if (reasoning.missedRiskFactors.length >= 2) {
      weaknesses.push({
        agentName: agent.agentName,
        weakness: "Missed risk factors",
        evidence: reasoning.missedRiskFactors.slice(0, 2).join("; "),
        severity: "high",
      });
    }
    if (agent.vetoQuality != null && agent.vetoQuality < 40) {
      weaknesses.push({
        agentName: agent.agentName,
        weakness: "Low veto quality",
        evidence: `Veto quality score ${agent.vetoQuality}%`,
        severity: "medium",
      });
    }
    if (agent.helpingScore < -0.5 && prediction.totalCalls >= 3) {
      weaknesses.push({
        agentName: agent.agentName,
        weakness: "Net hurting desk performance",
        evidence: `Helping score ${agent.helpingScore} · hit rate ${prediction.hitRate}%`,
        severity: "high",
      });
    }
  }

  return weaknesses.sort((a, b) => {
    const rank = { high: 0, medium: 1, low: 2 };
    return rank[a.severity] - rank[b.severity];
  });
}
