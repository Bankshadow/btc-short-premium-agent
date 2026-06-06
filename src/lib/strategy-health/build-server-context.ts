import { loadServerAnalysisJournal } from "@/lib/journal/journal-server-store";
import { listWarehouseRows } from "@/lib/db/repositories/warehouse-repository";
import { buildTestnetMonitorSnapshot } from "@/lib/testnet-monitor/build-testnet-monitor-snapshot";
import { loadServerUnifiedPortfolio } from "@/lib/portfolio/unified-paper-server-store";
import type { LiveTradeJournalEntry } from "@/lib/live-pilot/types";
import type { PaperOrder } from "@/lib/paper/paper-order-types";
import { filterProductionEntries, filterProductionOrders } from "@/lib/journal/production-filter";
import type { StrategyHealthInput } from "./types";

export async function buildStrategyHealthInputServer(): Promise<StrategyHealthInput> {
  const [entriesRaw, testnetSnapshot, unifiedPortfolio, liveRows, paperRows] = await Promise.all([
    loadServerAnalysisJournal().catch(() => []),
    buildTestnetMonitorSnapshot().catch(() => null),
    loadServerUnifiedPortfolio().catch(() => null),
    listWarehouseRows("live_trades", 200).catch(() => []),
    listWarehouseRows("paper_trades", 500).catch(() => []),
  ]);
  const liveTrades = liveRows
    .map((row) => row.payload as unknown)
    .filter((payload): payload is LiveTradeJournalEntry => {
      if (!payload || typeof payload !== "object") return false;
      const rec = payload as Record<string, unknown>;
      return typeof rec.liveTradeId === "string" && typeof rec.status === "string";
    });

  const ordersRaw = paperRows
    .map((row) => row.payload as unknown)
    .filter((payload): payload is PaperOrder => {
      if (!payload || typeof payload !== "object") return false;
      const rec = payload as Record<string, unknown>;
      return typeof rec.id === "string" && typeof rec.decisionLogId === "string";
    });

  return {
    entries: filterProductionEntries(entriesRaw),
    orders: filterProductionOrders(ordersRaw),
    unifiedPortfolio,
    testnetSnapshot,
    liveTrades,
  };
}
