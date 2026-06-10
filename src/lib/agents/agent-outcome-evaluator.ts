import type { JournalEvent } from "@/lib/journal/journal-types";
import type { AgentVote, ScenarioSwarmReport } from "@/lib/skills/mirofish-swarm/swarm-types";
import type { AgentScoreEntry } from "./agent-score-types";

function wasProfitable(result: string): boolean {
  return result === "WIN";
}

function voteCorrect(vote: AgentVote["vote"], result: string, side: string): boolean {
  const win = wasProfitable(result);
  if (vote === "BULLISH") return win && side === "BUY";
  if (vote === "BEARISH") return win && side === "SELL";
  if (vote === "RISK_OFF") return result === "LOSS";
  return result === "BREAKEVEN" || (!win && vote === "NEUTRAL");
}

export function evaluateSwarmAgentOutcomes(
  report: ScenarioSwarmReport,
  tradeResult: string,
  side: string,
): Partial<AgentScoreEntry>[] {
  return report.agentVotes.map((vote) => {
    const correct = voteCorrect(vote.vote, tradeResult, side);
    const overconfident = vote.confidence > 0.75 && !correct;
    const falseBullish = vote.vote === "BULLISH" && tradeResult === "LOSS" ? 1 : 0;
    const falseBearish = vote.vote === "BEARISH" && tradeResult === "WIN" ? 1 : 0;

    return {
      agentId: vote.agentId,
      role: vote.role,
      predictionAccuracy: correct ? 1 : 0,
      confidenceCalibration: overconfident ? 0.3 : correct ? vote.confidence : 1 - vote.confidence,
      falseBullish,
      falseBearish,
      riskWarningUsefulness: vote.vote === "RISK_OFF" && tradeResult === "LOSS" ? 1 : 0.5,
      overconfidenceDetected: overconfident,
      totalEvaluations: 1,
    };
  });
}

export function evaluateAnalysisAgentOutcome(
  events: JournalEvent[],
  tradeId: string,
): Partial<AgentScoreEntry> | null {
  const pnl = events.find((e) => e.type === "PNL_REALIZED" && e.tradeId === tradeId);
  if (!pnl) return null;

  const order = events.find((e) => e.type === "ORDER_EXECUTED" && e.tradeId === tradeId);
  const verdict = events.find(
    (e) =>
      e.type === "VERDICT_CREATED" &&
      e.decisionLogId === order?.decisionLogId,
  );
  const v = verdict?.payload as { verdict?: string; confidence?: number } | undefined;
  const result = (pnl.payload as { result?: string }).result ?? "UNKNOWN";
  const side = (order?.payload as { side?: string }).side ?? "SELL";

  const traded = v?.verdict === "TRADE";
  const win = result === "WIN";
  const correct = (traded && win) || (!traded && result === "LOSS");
  const confidence = v?.confidence ?? 0.5;
  const overconfident = confidence > 0.7 && !correct;

  return {
    agentId: "analysis-engine",
    role: "Analysis Engine",
    predictionAccuracy: correct ? 1 : 0,
    confidenceCalibration: overconfident ? 0.25 : correct ? confidence : 1 - confidence,
    falseBullish: traded && result === "LOSS" && side === "BUY" ? 1 : 0,
    falseBearish: traded && result === "LOSS" && side === "SELL" ? 1 : 0,
    riskWarningUsefulness: v?.verdict === "BLOCKED" ? 0.8 : 0.5,
    overconfidenceDetected: overconfident,
    totalEvaluations: 1,
  };
}
