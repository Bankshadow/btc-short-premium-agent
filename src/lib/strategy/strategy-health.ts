import { appendEvent, getEvents } from "@/lib/journal/journal-query";
import { getEvidenceProgressView } from "@/lib/evidence/evidence-progress";
import { tagTradeFromEvents, groupBySetup } from "./strategy-tagging";
import { listClosedTradeIds } from "@/lib/evidence/evidence-validator";
import type { StrategyHealthReport } from "./strategy-types";

function avg(nums: number[]) {
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
}

export async function buildStrategyHealthView(): Promise<StrategyHealthReport> {
  const events = await getEvents();
  const closedIds = listClosedTradeIds(events);
  const pnlByTrade = new Map<string, number>();
  const wins: number[] = [];
  for (const evt of events.filter((e) => e.type === "PNL_REALIZED")) {
    if (!evt.tradeId) continue;
    const net = Number((evt.payload as { netPnl?: number }).netPnl ?? 0);
    pnlByTrade.set(evt.tradeId, net);
    wins.push(net > 0 ? 1 : 0);
  }
  const tags = closedIds.map((id) => tagTradeFromEvents(id, events));
  const bySetup = groupBySetup(tags, pnlByTrade);
  let bestSetup: string | null = null;
  let worstSetup: string | null = null;
  let bestAvg = -Infinity;
  let worstAvg = Infinity;
  for (const [setup, pnls] of bySetup.entries()) {
    const a = avg(pnls);
    if (a > bestAvg) {
      bestAvg = a;
      bestSetup = setup;
    }
    if (a < worstAvg) {
      worstAvg = a;
      worstSetup = setup;
    }
  }
  const pnls = [...pnlByTrade.values()];
  const evidence = await getEvidenceProgressView();
  return {
    generatedAt: new Date().toISOString(),
    totalClosedTrades: closedIds.length,
    evidenceTrades: evidence.valid,
    winRate: pnls.length ? (wins.filter(Boolean).length / pnls.length) * 100 : 0,
    averagePnl: Number(avg(pnls).toFixed(4)),
    averageHoldMinutes: null,
    maxLoss: pnls.length ? Math.min(...pnls) : 0,
    bestSetup,
    worstSetup,
    invalidSetupCount: tags.filter((t) => t.setup === "UNKNOWN").length,
    advisoryOnly: true,
    liveLocked: true,
    message: "Strategy health is advisory only — no auto rule changes.",
  };
}

export async function calculateStrategyHealth(): Promise<StrategyHealthReport> {
  const report = await buildStrategyHealthView();
  await appendEvent({
    type: "STRATEGY_HEALTH_UPDATED",
    environment: "testnet",
    payload: { ...report },
  });

  return report;
}
