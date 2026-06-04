import type { AnalyzeApiResponse } from "@/lib/types/market";
import type { DeskReplaySnapshot } from "./replay-types";

export function buildReplaySnapshot(
  data: AnalyzeApiResponse,
): DeskReplaySnapshot {
  const desk = data.tradingDesk;
  return {
    analyzedAt: data.step5_verdict.analyzedAt,
    btcPrice: data.step1_marketSnapshot.spotPrice,
    marketRegime: desk?.marketRegime ?? "Unknown",
    committeeVerdict: desk?.committee.finalVerdict ?? "WAIT",
    riskVeto: desk?.committee.riskVeto ?? false,
    topReasons: desk?.committee.topReasons ?? [data.step5_verdict.summary],
    actionPlan:
      desk?.committee.finalActionPlan ?? data.step6_actionPlan.entryNotes,
    playbookRecommendation: data.step5_verdict.recommendation,
    researchBullets: desk?.research.summaryBullets ?? [],
    agentOutputs: desk?.agents ?? [],
  };
}

export function replaySnapshotFromLog(
  entry: {
    timestamp: string;
    btcPrice: number;
    marketRegime: string;
    finalVerdict: DeskReplaySnapshot["committeeVerdict"];
    riskVeto: boolean;
    topReasons: string[];
    actionPlan: string;
    agentOutputs: DeskReplaySnapshot["agentOutputs"];
    replaySnapshot?: DeskReplaySnapshot | null;
  },
): DeskReplaySnapshot {
  if (entry.replaySnapshot) return entry.replaySnapshot;
  return {
    analyzedAt: entry.timestamp,
    btcPrice: entry.btcPrice,
    marketRegime: entry.marketRegime,
    committeeVerdict: entry.finalVerdict,
    riskVeto: entry.riskVeto,
    topReasons: entry.topReasons,
    actionPlan: entry.actionPlan,
    playbookRecommendation: "wait",
    researchBullets: [],
    agentOutputs: entry.agentOutputs,
  };
}
