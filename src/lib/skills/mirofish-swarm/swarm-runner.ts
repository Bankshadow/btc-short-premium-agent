import { appendEvent, getEvents } from "@/lib/journal/journal-query";
import { newSwarmReportId, newRunId } from "@/lib/journal/journal-types";
import { buildMissionSnapshot } from "@/lib/mission/mission-snapshot";
import { aggregateSignal, runAgentVotes } from "./swarm-agents";
import type { RecommendedAction, ScenarioSwarmReport, SwarmRunResult } from "./swarm-types";

function recommendedAction(signal: ReturnType<typeof aggregateSignal>): RecommendedAction {
  if (signal === "RISK_OFF") return "REDUCE_RISK";
  if (signal === "NEUTRAL") return "WATCH";
  if (signal === "BULLISH" || signal === "BEARISH") return "ALLOW_ANALYSIS";
  return "WAIT";
}

export async function runMirofishSwarm(input?: {
  seedNote?: string;
}): Promise<SwarmRunResult> {
  const runId = newRunId();
  await appendEvent({
    type: "MIROFISH_SWARM_STARTED",
    environment: "testnet",
    runId,
    payload: { seedNote: input?.seedNote ?? null },
  });

  const events = await getEvents();
  const mission = buildMissionSnapshot(events);
  const votes = runAgentVotes({
    netPnl: mission.netPnl,
    openPositions: mission.openPositions,
  });

  for (const vote of votes) {
    await appendEvent({
      type: "MIROFISH_AGENT_VOTED",
      environment: "testnet",
      runId,
      payload: { ...vote },
    });
  }

  const advisorySignal = aggregateSignal(votes);
  const confidence = Number(
    (votes.reduce((s, v) => s + v.confidence, 0) / votes.length).toFixed(2),
  );

  const report: ScenarioSwarmReport = {
    reportId: newSwarmReportId(),
    runId,
    createdAt: new Date().toISOString(),
    likelyScenario:
      advisorySignal === "BULLISH"
        ? "Gradual continuation with volatility pockets."
        : advisorySignal === "BEARISH"
          ? "Drift lower with failed rallies."
          : advisorySignal === "RISK_OFF"
            ? "Choppy range with downside tail risk."
            : "Range-bound chop — wait for clearer edge.",
    upsideScenario: "BTC holds support and mean-reverts toward recent highs.",
    downsideScenario: "Breakdown below recent structure with liquidity sweep.",
    liquidityTrapRisk: "Moderate on testnet — real liquidity differs.",
    volatilityRisk: "Elevated until more closed evidence trades exist.",
    invalidationPoints: ["Loss of recent swing low", "Failed retest of breakdown level"],
    keyLevels: ["Recent local high", "Recent local low"],
    agentVotes: votes,
    confidence,
    advisorySignal,
    recommendedAction: recommendedAction(advisorySignal),
    safetyNote:
      "Advisory only. Swarm cannot create previews, execute orders, or change risk/strategy.",
  };

  await appendEvent({
    type: "MIROFISH_SCENARIO_REPORT_CREATED",
    environment: "testnet",
    runId,
    payload: { ...report },
  });

  return { ok: true, report, message: "Scenario swarm report created." };
}

export async function getLatestSwarmReport(): Promise<ScenarioSwarmReport | null> {
  const events = await getEvents();
  const evt = events.find((e) => e.type === "MIROFISH_SCENARIO_REPORT_CREATED");
  if (!evt) return null;
  return evt.payload as unknown as ScenarioSwarmReport;
}
