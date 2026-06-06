import type { LedgerEntry, TradeLifecycleStage, TradeTimeline } from "./types";
import { advanceLifecycle } from "./lifecycle";

export function buildTradeTimelines(entries: LedgerEntry[]): TradeTimeline[] {
  const byTrade = new Map<string, LedgerEntry[]>();

  for (const e of entries) {
    const tradeId = e.linkedTradeId ?? e.linkedDecisionId;
    if (!tradeId) continue;
    const list = byTrade.get(tradeId) ?? [];
    list.push(e);
    byTrade.set(tradeId, list);
  }

  const timelines: TradeTimeline[] = [];

  for (const [tradeId, events] of byTrade) {
    if (events.length === 0) continue;
    const tradeEvents = events.filter((e) => e.entryKind === "TRADE");
    const anchor = tradeEvents[0] ?? events[0];
    let stage: TradeLifecycleStage = "SIGNAL";
    for (const e of events) {
      if (e.lifecycleStage) {
        stage = advanceLifecycle(stage, e.lifecycleStage);
      }
    }

    timelines.push({
      tradeId,
      decisionId: anchor.linkedDecisionId,
      runId: anchor.linkedRunId,
      environment: anchor.environment,
      asset: anchor.asset ?? "BTC",
      strategy: anchor.strategy ?? null,
      assetClass: anchor.assetClass ?? "unknown",
      currentStage: stage,
      events: [...events].sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
      ),
    });
  }

  return timelines.sort(
    (a, b) =>
      new Date(b.events[b.events.length - 1]?.timestamp ?? 0).getTime() -
      new Date(a.events[a.events.length - 1]?.timestamp ?? 0).getTime(),
  );
}
