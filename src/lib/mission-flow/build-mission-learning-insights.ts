import type { TestnetLearningRecord } from "@/lib/testnet-monitor/types";
import type { MissionFlowLearningInsights } from "./types";

export function buildMissionLearningInsights(
  records: TestnetLearningRecord[],
): MissionFlowLearningInsights {
  const learned = records.filter((r) => r.status === "LEARNED" && r.includeInLearning);
  const wins = learned.filter((r) => r.result === "WIN");
  const losses = learned.filter((r) => r.result === "LOSS");
  const rValues = learned.map((r) => r.rMultiple).filter((r) => Number.isFinite(r));
  const avgR =
    rValues.length > 0
      ? Number((rValues.reduce((a, b) => a + b, 0) / rValues.length).toFixed(2))
      : null;

  const recent = [...learned]
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
    .slice(0, 5)
    .map((r) => ({
      symbol: r.symbol,
      result: r.result,
      netPnl: r.netPnl,
      rMultiple: r.rMultiple,
      updatedAt: r.updatedAt,
    }));

  return {
    learnedCount: learned.length,
    winCount: wins.length,
    lossCount: losses.length,
    avgR,
    recent,
  };
}
