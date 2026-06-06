import type { StrategyHealthSummary } from "@/lib/strategy-health/types";
import type { MissionFlowStrategyHealth } from "./types";

const PRIMARY_STRATEGY_ID = "options_short_premium";

export function resolvePrimaryStrategyHealth(
  summary: StrategyHealthSummary | null | undefined,
): MissionFlowStrategyHealth | null {
  if (!summary?.rows?.length) return null;

  const row =
    summary.rows.find((r) => r.strategyId === PRIMARY_STRATEGY_ID) ?? summary.rows[0];

  const tradeBlocked =
    row.currentStatus === "PAUSED" || row.currentStatus === "REVIEW_REQUIRED";

  return {
    strategyId: row.strategyId,
    label: row.strategyLabel,
    status: row.currentStatus,
    recommendation: row.recommendation,
    winRate: row.winRate,
    sampleSize: row.sampleSize,
    healthScorePct: null,
    tradeAllowed: !tradeBlocked,
    blockReason: tradeBlocked
      ? `Strategy ${row.currentStatus.replace(/_/g, " ").toLowerCase()} — ${row.recommendation}`
      : null,
  };
}
