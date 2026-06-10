import { appendEvent, getEvents } from "@/lib/journal/journal-query";
import type { ScenarioSwarmReport } from "@/lib/skills/mirofish-swarm/swarm-types";
import {
  evaluateAnalysisAgentOutcome,
  evaluateSwarmAgentOutcomes,
} from "./agent-outcome-evaluator";
import type { AgentScoreboard, AgentScoreEntry } from "./agent-score-types";

function mergeScores(existing: AgentScoreEntry, update: Partial<AgentScoreEntry>): AgentScoreEntry {
  const total = existing.totalEvaluations + (update.totalEvaluations ?? 1);
  const weight = 1 / total;
  const prevWeight = 1 - weight;

  return {
    agentId: existing.agentId,
    role: existing.role,
    predictionAccuracy:
      existing.predictionAccuracy * prevWeight + (update.predictionAccuracy ?? 0) * weight,
    confidenceCalibration:
      existing.confidenceCalibration * prevWeight +
      (update.confidenceCalibration ?? 0) * weight,
    falseBullish: existing.falseBullish + (update.falseBullish ?? 0),
    falseBearish: existing.falseBearish + (update.falseBearish ?? 0),
    riskWarningUsefulness:
      existing.riskWarningUsefulness * prevWeight +
      (update.riskWarningUsefulness ?? 0) * weight,
    regimePerformance: existing.regimePerformance,
    overconfidenceDetected:
      existing.overconfidenceDetected || (update.overconfidenceDetected ?? false),
    totalEvaluations: total,
    updatedAt: new Date().toISOString(),
  };
}

function loadExistingScores(events: Awaited<ReturnType<typeof getEvents>>): Map<string, AgentScoreEntry> {
  const map = new Map<string, AgentScoreEntry>();
  for (const evt of events.filter((e) => e.type === "AGENT_SCORE_UPDATED")) {
    const p = evt.payload as unknown as AgentScoreEntry;
    map.set(p.agentId, p);
  }
  return map;
}

async function updateScoresForClosedTrade(
  tradeId: string,
  events: Awaited<ReturnType<typeof getEvents>>,
  scores: Map<string, AgentScoreEntry>,
): Promise<void> {
  const alreadyScored = events.some(
    (e) => e.type === "AGENT_SCORE_UPDATED" && e.tradeId === tradeId,
  );
  if (alreadyScored) return;

  const pnl = events.find((e) => e.type === "PNL_REALIZED" && e.tradeId === tradeId);
  if (!pnl) return;

  const closed = events.find((e) => e.type === "POSITION_CLOSED" && e.tradeId === tradeId);
  if (!closed) return;

  const result = (pnl.payload as { result?: string }).result ?? "UNKNOWN";
  const order = events.find((e) => e.type === "ORDER_EXECUTED" && e.tradeId === tradeId);
  const side = (order?.payload as { side?: string }).side ?? "SELL";

  const swarmEvt = [...events]
    .filter((e) => e.type === "MIROFISH_SCENARIO_REPORT_CREATED")
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0];
  if (swarmEvt) {
    const report = swarmEvt.payload as unknown as ScenarioSwarmReport;
    for (const partial of evaluateSwarmAgentOutcomes(report, result, side)) {
      const id = partial.agentId!;
      const existing = scores.get(id) ?? {
        agentId: id,
        role: partial.role ?? id,
        predictionAccuracy: 0,
        confidenceCalibration: 0.5,
        falseBullish: 0,
        falseBearish: 0,
        riskWarningUsefulness: 0.5,
        regimePerformance: {},
        overconfidenceDetected: false,
        totalEvaluations: 0,
        updatedAt: new Date().toISOString(),
      };
      const merged = mergeScores(existing, partial);
      scores.set(id, merged);
      await appendEvent({
        type: "AGENT_SCORE_UPDATED",
        environment: "testnet",
        tradeId,
        payload: { ...merged },
      });
      if (merged.overconfidenceDetected) {
        await appendEvent({
          type: "AGENT_OVERCONFIDENCE_DETECTED",
          environment: "testnet",
          tradeId,
          payload: { agentId: id, role: merged.role },
        });
      }
    }
  }

  const analysisPartial = evaluateAnalysisAgentOutcome(events, tradeId);
  if (analysisPartial?.agentId) {
    const id = analysisPartial.agentId;
    const existing = scores.get(id) ?? {
      agentId: id,
      role: "Analysis Engine",
      predictionAccuracy: 0,
      confidenceCalibration: 0.5,
      falseBullish: 0,
      falseBearish: 0,
      riskWarningUsefulness: 0.5,
      regimePerformance: {},
      overconfidenceDetected: false,
      totalEvaluations: 0,
      updatedAt: new Date().toISOString(),
    };
    const merged = mergeScores(existing, analysisPartial);
    scores.set(id, merged);
    await appendEvent({
      type: "AGENT_SCORE_UPDATED",
      environment: "testnet",
      tradeId,
      payload: { ...merged },
    });
    await appendEvent({
      type: "AGENT_CONFIDENCE_ADJUSTED",
      environment: "testnet",
      tradeId,
      payload: {
        agentId: id,
        calibration: merged.confidenceCalibration,
        advisoryOnly: true,
      },
    });
  }
}

export async function updateAgentScoresForTrade(tradeId: string): Promise<void> {
  const events = await getEvents();
  const scores = loadExistingScores(events);
  await updateScoresForClosedTrade(tradeId, events, scores);
}

export async function recalculateAgentScoreboard(): Promise<AgentScoreboard> {
  const events = await getEvents();
  const scores = loadExistingScores(events);

  const closedTrades = events.filter((e) => e.type === "POSITION_CLOSED" && e.tradeId);
  for (const closed of closedTrades) {
    await updateScoresForClosedTrade(closed.tradeId!, events, scores);
  }

  return buildAgentScoreboardView();
}

export async function buildAgentScoreboardView(): Promise<AgentScoreboard> {
  const events = await getEvents();
  const scores = loadExistingScores(events);

  return {
    generatedAt: new Date().toISOString(),
    agents: [...scores.values()].sort((a, b) => b.predictionAccuracy - a.predictionAccuracy),
    advisoryOnly: true,
    liveLocked: true,
    message: "Agent scores are advisory — not applied to execution weights.",
  };
}
