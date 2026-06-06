import type { AgentOutput } from "@/lib/agents/types";
import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import { strategiesSignaledOnEntry } from "@/lib/validation/classify-strategy";
import { confidenceToProbability, gradeFromHitRate } from "./confidence";
import type {
  AgentEvaluation,
  AgentPredictionScore,
  AgentReasoningScore,
  ContextPerformanceSlice,
  PostTradeEvaluationSource,
  TradeEvaluationResult,
} from "./types";
import { CORE_EVALUATION_AGENTS } from "./types";
import { buildTradeQualityScore } from "@/lib/trade-quality-score/score-trade";

const COMMITTEE_NAME = "Investment Committee";

function detectAsset(entry: DecisionLogEntry): string {
  if (entry.orderTicket?.symbol) return entry.orderTicket.symbol;
  return "BTCUSDT";
}

function agentOutcomeFlags(
  agent: AgentOutput,
  tradeWouldWin: boolean | null,
): {
  correctTrade: boolean;
  correctSkip: boolean;
  falsePositive: boolean;
  falseNegative: boolean;
  hit: boolean;
} {
  if (tradeWouldWin === null) {
    return {
      correctTrade: false,
      correctSkip: true,
      falsePositive: false,
      falseNegative: false,
      hit: true,
    };
  }

  if (agent.recommendation === "TRADE") {
    if (tradeWouldWin) {
      return {
        correctTrade: true,
        correctSkip: false,
        falsePositive: false,
        falseNegative: false,
        hit: true,
      };
    }
    return {
      correctTrade: false,
      correctSkip: false,
      falsePositive: true,
      falseNegative: false,
      hit: false,
    };
  }

  if (!tradeWouldWin) {
    return {
      correctTrade: false,
      correctSkip: true,
      falsePositive: false,
      falseNegative: false,
      hit: true,
    };
  }
  return {
    correctTrade: false,
    correctSkip: false,
    falsePositive: false,
    falseNegative: true,
    hit: false,
  };
}

function scoreReasoning(
  agent: AgentOutput,
  entry: DecisionLogEntry,
  flags: ReturnType<typeof agentOutcomeFlags>,
): AgentReasoningScore {
  const reflection = entry.reflection;
  const missedRiskFactors: string[] = [];

  let riskWarningUsefulness = 50;
  let reasoningQuality = 55;

  if (reflection) {
    if (reflection.tooAggressiveAgents.includes(agent.agentName)) {
      reasoningQuality -= 25;
      missedRiskFactors.push("Flagged as too aggressive in reflection");
    }
    for (const wrong of reflection.whatWasWrong) {
      const covered = agent.risks.some((r) =>
        r.toLowerCase().includes(wrong.slice(0, 12).toLowerCase()),
      );
      if (!covered) missedRiskFactors.push(wrong);
    }
    for (const rule of reflection.helpfulRiskRules) {
      const matched = agent.risks.some((r) =>
        rule.toLowerCase().includes(r.slice(0, 10).toLowerCase()),
      );
      if (matched) riskWarningUsefulness += 15;
    }
  }

  if (flags.falsePositive && agent.risks.length === 0) {
    reasoningQuality -= 15;
    missedRiskFactors.push("No risk warnings before false-positive TRADE");
  }

  if (agent.missingData.length > 0 && flags.falsePositive) {
    missedRiskFactors.push(`Ignored missing data: ${agent.missingData.join(", ")}`);
    reasoningQuality -= 10;
  }

  const actualOutcome =
    entry.resolution?.tradeWouldWin === true
      ? 1
      : entry.resolution?.tradeWouldWin === false
        ? 0
        : 0.5;
  const confidenceCalibrationError =
    agent.recommendation === "TRADE"
      ? Math.abs(confidenceToProbability(agent.confidence) - actualOutcome)
      : Math.abs(confidenceToProbability(agent.confidence) - (1 - actualOutcome));

  const regretScore = Math.min(
    100,
    (entry.missedOpportunityR ?? 0) * 10 +
      (entry.avoidedLossR ?? 0) * 5 +
      (entry.falseTradeFlag ? 20 : 0) +
      (entry.falseSkipFlag ? 15 : 0) +
      (flags.falsePositive ? 25 : 0) +
      (flags.falseNegative ? 20 : 0),
  );

  return {
    riskWarningUsefulness: Math.max(0, Math.min(100, riskWarningUsefulness)),
    missedRiskFactors: [...new Set(missedRiskFactors)].slice(0, 5),
    reasoningQuality: Math.max(0, Math.min(100, reasoningQuality)),
    confidenceCalibrationError: Number(confidenceCalibrationError.toFixed(3)),
    regretScore: Number(regretScore.toFixed(1)),
  };
}

function buildPredictionScore(
  flags: ReturnType<typeof agentOutcomeFlags>,
  pnlPct: number,
): AgentPredictionScore {
  return {
    hitRate: flags.hit ? 100 : 0,
    avgPnlAfterTradeRec: flags.correctTrade || flags.falsePositive ? pnlPct : 0,
    avoidedLossAfterSkip: flags.correctSkip && pnlPct < 0 ? Math.abs(pnlPct) : 0,
    opportunityCostWrongSkip: flags.falseNegative ? Math.max(0, pnlPct) : 0,
    lossFromWrongTrade: flags.falsePositive ? Math.min(0, pnlPct) : 0,
    falsePositives: flags.falsePositive ? 1 : 0,
    falseNegatives: flags.falseNegative ? 1 : 0,
    correctTradeCalls: flags.correctTrade ? 1 : 0,
    correctSkips: flags.correctSkip ? 1 : 0,
    totalCalls: 1,
  };
}

function contributionScore(
  agent: AgentOutput,
  finalVerdict: DecisionLogEntry["finalVerdict"],
): number {
  if (agent.recommendation === finalVerdict) return 1;
  if (
    (agent.recommendation === "SKIP" || agent.recommendation === "WAIT") &&
    finalVerdict === "SKIP"
  ) {
    return 0.5;
  }
  return -1;
}

function evaluateAgentOnEntry(
  agent: AgentOutput,
  entry: DecisionLogEntry,
  pnlPct: number,
  tradeWouldWin: boolean | null,
  asset: string,
  strategies: string[],
): AgentEvaluation {
  const flags = agentOutcomeFlags(agent, tradeWouldWin);
  const prediction = buildPredictionScore(flags, pnlPct);
  const reasoning = scoreReasoning(agent, entry, flags);

  let vetoQuality: number | undefined;
  if (agent.agentName === "Risk Manager Agent" && agent.veto) {
    vetoQuality =
      tradeWouldWin === false || pnlPct < 0
        ? 100
        : tradeWouldWin === true
          ? 0
          : 50;
  }

  const helpingScore =
    (flags.hit ? 1 : -1) +
    (reasoning.riskWarningUsefulness - 50) / 50 -
    reasoning.confidenceCalibrationError;

  const slice = (label: string): ContextPerformanceSlice => ({
    label,
    hitRate: prediction.hitRate,
    sampleSize: 1,
    avgPnlPct: pnlPct,
  });

  return {
    agentName: agent.agentName,
    prediction,
    reasoning,
    contributionToVerdict: contributionScore(agent, entry.finalVerdict),
    vetoQuality,
    byRegime: [slice(entry.marketRegime)],
    byAsset: [slice(asset)],
    byStrategy: strategies.map(slice),
    overallGrade: gradeFromHitRate(prediction.hitRate, 1),
    helpingScore: Number(helpingScore.toFixed(2)),
  };
}

function evaluateCommittee(
  entry: DecisionLogEntry,
  pnlPct: number,
  tradeWouldWin: boolean | null,
  asset: string,
  strategies: string[],
): AgentEvaluation {
  const synthetic: AgentOutput = {
    agentName: COMMITTEE_NAME,
    recommendation: entry.finalVerdict,
    strategyType: "RISK",
    confidence: entry.riskVeto ? "HIGH" : "MEDIUM",
    marketView: "Committee consensus",
    reasons: entry.topReasons,
    risks: [],
    proposedAction: entry.actionPlan,
    missingData: [],
    veto: entry.riskVeto,
    vetoReasons: entry.riskVeto ? entry.topReasons : undefined,
  };
  return evaluateAgentOnEntry(
    synthetic,
    entry,
    pnlPct,
    tradeWouldWin,
    asset,
    strategies,
  );
}

function buildImprovementHints(
  evaluations: AgentEvaluation[],
  entry: DecisionLogEntry,
): string[] {
  const hints: string[] = [];
  for (const ev of evaluations) {
    if (ev.prediction.falsePositives > 0) {
      hints.push(
        `${ev.agentName}: false-positive TRADE in ${entry.marketRegime} — tighten entry filters.`,
      );
    }
    if (ev.prediction.falseNegatives > 0) {
      hints.push(
        `${ev.agentName}: missed winning trade in ${entry.marketRegime} — review SKIP threshold.`,
      );
    }
    if (ev.reasoning.missedRiskFactors.length > 0) {
      hints.push(
        `${ev.agentName}: missed risks — ${ev.reasoning.missedRiskFactors[0]}`,
      );
    }
  }
  if (entry.riskVeto && (entry.paperPnl ?? 0) > 0) {
    hints.push("Risk Manager veto may have blocked a winning trade — review veto calibration.");
  }
  return [...new Set(hints)].slice(0, 6);
}

export function evaluateClosedTrade(input: {
  entry: DecisionLogEntry;
  source: PostTradeEvaluationSource;
  liveTradeId?: string;
  pnlOverride?: number;
}): TradeEvaluationResult | null {
  const { entry, source, liveTradeId, pnlOverride } = input;
  if (entry.outcomeStatus !== "RESOLVED") return null;

  const pnlPct = pnlOverride ?? entry.paperPnl ?? 0;
  const tradeWouldWin =
    entry.resolution?.tradeWouldWin ??
    (pnlPct > 0 ? true : pnlPct < 0 ? false : null);
  const asset = detectAsset(entry);
  const strategies = strategiesSignaledOnEntry(entry);

  const targetSet = new Set<string>([...CORE_EVALUATION_AGENTS]);
  const agentsToEval = entry.agentOutputs.filter((a) =>
    targetSet.has(a.agentName),
  );

  const agentEvaluations = agentsToEval.map((agent) =>
    evaluateAgentOnEntry(agent, entry, pnlPct, tradeWouldWin, asset, strategies),
  );

  const committeeEvaluation = evaluateCommittee(
    entry,
    pnlPct,
    tradeWouldWin,
    asset,
    strategies,
  );

  const base = {
    evaluationId: `eval-${entry.id}-${Date.now()}`,
    decisionLogId: entry.id,
    liveTradeId,
    generatedAt: new Date().toISOString(),
    source,
    marketRegime: entry.marketRegime,
    asset,
    strategies,
    pnlPct,
    tradeWouldWin,
    finalVerdict: entry.finalVerdict,
    agentEvaluations,
    committeeEvaluation,
    improvementHints: buildImprovementHints(
      [...agentEvaluations, committeeEvaluation],
      entry,
    ),
  };

  const tradeQuality = buildTradeQualityScore({
    entry,
    evaluation: base,
    source,
    pnlPct,
    tradeWouldWin,
  });

  return { ...base, tradeQuality };
}
