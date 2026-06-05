import type {
  AgentEvaluation,
  ImprovementRecommendation,
  RegimeEvaluation,
  StrategyEvaluation,
} from "./types";

export function generateImprovementRecommendations(input: {
  leaderboard: AgentEvaluation[];
  strategyReports: StrategyEvaluation[];
  regimeReports: RegimeEvaluation[];
}): ImprovementRecommendation[] {
  const recs: ImprovementRecommendation[] = [];
  let idx = 0;

  const worstAgent = [...input.leaderboard]
    .filter((a) => a.prediction.totalCalls >= 2)
    .sort((a, b) => a.helpingScore - b.helpingScore)[0];
  if (worstAgent && worstAgent.helpingScore < 0) {
    recs.push({
      id: `imp-${idx++}`,
      target: "agent",
      targetId: worstAgent.agentName,
      title: `Review ${worstAgent.agentName} calibration`,
      problem: `Helping score ${worstAgent.helpingScore} · hit rate ${worstAgent.prediction.hitRate}%`,
      suggestedAction:
        "Add draft rule tightening this agent's TRADE threshold; paper-test before registry change.",
      adaptationProposalHint: `TIGHTEN_RULE on agent ${worstAgent.agentName}`,
      confidence: 65,
    });
  }

  const worstStrategy = [...input.strategyReports]
    .filter((s) => s.sampleSize >= 3)
    .sort((a, b) => a.avgPnlPct - b.avgPnlPct)[0];
  if (worstStrategy && worstStrategy.avgPnlPct < 0) {
    recs.push({
      id: `imp-${idx++}`,
      target: "strategy",
      targetId: worstStrategy.strategyId,
      title: `Demote or pause ${worstStrategy.label}`,
      problem: `Avg PnL ${worstStrategy.avgPnlPct}% over ${worstStrategy.sampleSize} signals`,
      suggestedAction:
        "Create adaptation proposal to move strategy to WATCHLIST or PAPER_TESTING.",
      adaptationProposalHint: `DEMOTE ${worstStrategy.strategyId}`,
      confidence: 70,
    });
  }

  const weakRegime = [...input.regimeReports]
    .filter((r) => r.sampleSize >= 2)
    .sort((a, b) => a.avgPnlPct - b.avgPnlPct)[0];
  if (weakRegime && weakRegime.avgPnlPct < -1) {
    recs.push({
      id: `imp-${idx++}`,
      target: "regime",
      targetId: weakRegime.regime,
      title: `Reduce TRADE rate in ${weakRegime.regime}`,
      problem: `Regime net ${weakRegime.avgPnlPct}% · worst agent ${weakRegime.worstAgent ?? "—"}`,
      suggestedAction:
        "Bias committee to WAIT in this regime until more paper proof accumulates.",
      adaptationProposalHint: `TIGHTEN_RULE regime:${weakRegime.regime}`,
      confidence: 60,
    });
  }

  const highFp = input.leaderboard.find((a) => a.prediction.falsePositives >= 3);
  if (highFp) {
    recs.push({
      id: `imp-${idx++}`,
      target: "agent",
      targetId: highFp.agentName,
      title: `Reduce false positives from ${highFp.agentName}`,
      problem: `${highFp.prediction.falsePositives} false-positive TRADE calls`,
      suggestedAction:
        "Require additional data-quality or risk checks before this agent may signal TRADE.",
      adaptationProposalHint: `TIGHTEN_RULE agent:${highFp.agentName}`,
      confidence: 72,
    });
  }

  if (recs.length === 0) {
    recs.push({
      id: `imp-${idx++}`,
      target: "desk",
      targetId: "desk",
      title: "Continue paper logging",
      problem: "Insufficient evaluation sample for strong recommendations.",
      suggestedAction:
        "Resolve more outcomes and close paper trades to deepen self-learning metrics.",
      adaptationProposalHint: "REVIEW_ONLY desk",
      confidence: 40,
    });
  }

  return recs.slice(0, 8);
}
