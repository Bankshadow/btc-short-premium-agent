import type { JournalEvent } from "@/lib/journal/journal-types";
import type { StrategyRegimeTag, StrategySetupTag, StrategyTradeTag } from "./strategy-types";

export function tagTradeFromEvents(tradeId: string, events: JournalEvent[]): StrategyTradeTag {
  const order = events.find((e) => e.type === "ORDER_EXECUTED" && e.tradeId === tradeId);
  const side = (order?.payload as { side?: string }).side;
  const verdict = events.find(
    (e) =>
      e.type === "VERDICT_CREATED" &&
      e.decisionLogId === order?.decisionLogId,
  );
  const payload = verdict?.payload as { reasons?: string[] } | undefined;
  const reasons = (payload?.reasons ?? []).join(" ").toLowerCase();

  let setup: StrategySetupTag = "UNKNOWN";
  if (side === "SELL") setup = "SHORT_PREMIUM";
  else if (reasons.includes("mean")) setup = "MEAN_REVERT";

  let regime: StrategyRegimeTag = "UNKNOWN";
  if (reasons.includes("trend")) regime = "TREND";
  else if (reasons.includes("range")) regime = "RANGE";

  return {
    tradeId,
    setup,
    regime,
    entryReason: reasons || "testnet manual execution",
  };
}

export function groupBySetup(
  tags: StrategyTradeTag[],
  pnlByTrade: Map<string, number>,
): Map<string, number[]> {
  const map = new Map<string, number[]>();
  for (const tag of tags) {
    const pnl = pnlByTrade.get(tag.tradeId);
    if (pnl == null) continue;
    const list = map.get(tag.setup) ?? [];
    list.push(pnl);
    map.set(tag.setup, list);
  }
  return map;
}
