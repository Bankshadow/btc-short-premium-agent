import { runQuantBacktest } from "@/lib/quant-backtest/run-quant-backtest";
import { isQuantBacktestRunnerSupported } from "@/lib/quant-backtest/signal-runners";
import { getSeedById } from "@/lib/quant-strategy-importer/build-catalog";
import { loadCustomStrategies, saveGarageBacktestSummary } from "./garage-store";
import type { GarageBacktestSummary } from "./types";

export async function runGarageBacktest(input: {
  sourceId: string;
  symbol?: "BTCUSDT" | "SOLUSDT";
  lookbackDays?: number;
}): Promise<{ ok: boolean; summary: GarageBacktestSummary | null; message: string; executionBlocked: true }> {
  const custom = (await loadCustomStrategies()).find((s) => s.sourceId === input.sourceId);
  const seed = getSeedById(input.sourceId);
  if (!seed && !custom) {
    return {
      ok: false,
      summary: null,
      message: `Unknown strategy: ${input.sourceId}`,
      executionBlocked: true,
    };
  }

  if (!isQuantBacktestRunnerSupported(input.sourceId)) {
    return {
      ok: false,
      summary: null,
      message:
        "Backtest runner not available for this strategy yet. Use shadow mode or manual review.",
      executionBlocked: true,
    };
  }

  const end = new Date();
  const start = new Date(end.getTime() - (input.lookbackDays ?? 180) * 86_400_000);

  const result = await runQuantBacktest({
    sourceId: input.sourceId,
    symbol: input.symbol ?? "BTCUSDT",
    timeframe: "4h",
    startDate: start.toISOString(),
    endDate: end.toISOString(),
    friction: { feeBps: 4, slippageBps: 3, spreadBps: 2 },
  });

  const summary: GarageBacktestSummary = {
    runId: result.runId,
    symbol: result.symbol,
    timeframe: result.timeframe,
    aiVerdict: result.aiRecommendation.verdict,
    winRate: result.metrics.winRate,
    netPnlPct: result.metrics.totalReturnPct,
    maxDrawdownPct: result.metrics.maxDrawdownPct,
    tradeCount: result.metrics.tradeCount,
    completedAt: new Date().toISOString(),
  };

  await saveGarageBacktestSummary(input.sourceId, summary);

  return {
    ok: true,
    summary,
    message: `Backtest complete · ${summary.aiVerdict} · ${summary.tradeCount} trades · ${summary.netPnlPct}% net`,
    executionBlocked: true,
  };
}
