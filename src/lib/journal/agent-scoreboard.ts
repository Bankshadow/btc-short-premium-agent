import type { AgentOutput, AgentRecommendation } from "@/lib/agents/types";
import type { DecisionLogEntry } from "./decision-log-types";

export interface AgentScoreRow {
  agentName: string;
  strategyType: AgentOutput["strategyType"];
  totalCalls: number;
  correctTradeCalls: number;
  correctSkips: number;
  falsePositives: number;
  falseNegatives: number;
}

export interface DeskScoreboard {
  totalResolved: number;
  totalPending: number;
  riskVetoAccuracyPct: number;
  riskVetoCount: number;
  correctVetoes: number;
  netPaperPnlPct: number;
  agents: AgentScoreRow[];
}

function agentWasCorrect(
  agent: AgentOutput,
  deskVerdict: AgentRecommendation,
  tradeWouldWin: boolean | null,
): { trade: boolean; skip: boolean; fp: boolean; fn: boolean } {
  const rec = agent.recommendation;
  let trade = false;
  let skip = false;
  let fp = false;
  let fn = false;

  if (tradeWouldWin === null) {
    if (rec === deskVerdict) skip = true;
    return { trade, skip, fp, fn };
  }

  if (rec === "TRADE") {
    if (tradeWouldWin) trade = true;
    else fp = true;
  } else if (rec === "SKIP" || rec === "WAIT") {
    if (!tradeWouldWin) skip = true;
    else fn = true;
  }

  return { trade, skip, fp, fn };
}

export function buildAgentScoreboard(
  entries: DecisionLogEntry[],
): DeskScoreboard {
  const resolved = entries.filter((e) => e.outcomeStatus === "RESOLVED");
  const pending = entries.filter((e) => e.outcomeStatus === "PENDING");
  const byAgent = new Map<string, AgentScoreRow>();

  let correctVetoes = 0;
  let riskVetoCount = 0;
  let netPaperPnl = 0;

  for (const entry of resolved) {
    netPaperPnl += entry.paperPnl ?? 0;
    const tradeWouldWin = entry.resolution?.tradeWouldWin ?? null;

    if (entry.riskVeto) {
      riskVetoCount += 1;
      if (tradeWouldWin === false || entry.finalVerdict === "SKIP") {
        correctVetoes += 1;
      }
    }

    for (const agent of entry.agentOutputs) {
      const key = agent.agentName;
      const row = byAgent.get(key) ?? {
        agentName: key,
        strategyType: agent.strategyType,
        totalCalls: 0,
        correctTradeCalls: 0,
        correctSkips: 0,
        falsePositives: 0,
        falseNegatives: 0,
      };
      row.totalCalls += 1;
      const score = agentWasCorrect(
        agent,
        entry.finalVerdict,
        tradeWouldWin,
      );
      if (score.trade) row.correctTradeCalls += 1;
      if (score.skip) row.correctSkips += 1;
      if (score.fp) row.falsePositives += 1;
      if (score.fn) row.falseNegatives += 1;
      byAgent.set(key, row);
    }
  }

  const agents = [...byAgent.values()].sort(
    (a, b) => b.totalCalls - a.totalCalls,
  );

  return {
    totalResolved: resolved.length,
    totalPending: pending.length,
    riskVetoAccuracyPct:
      riskVetoCount > 0
        ? Math.round((correctVetoes / riskVetoCount) * 100)
        : 0,
    riskVetoCount,
    correctVetoes,
    netPaperPnlPct: Number(netPaperPnl.toFixed(2)),
    agents,
  };
}
