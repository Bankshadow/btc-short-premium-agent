import { listWarehouseRows } from "@/lib/db/repositories/warehouse-repository";
import { loadServerBinanceTestnetJournal } from "@/lib/exchange/binance/binance-testnet-journal-server";
import type { BinanceTestnetJournalEntry } from "@/lib/exchange/binance/binance-types";
import type { LiveTradeJournalEntry } from "@/lib/live-pilot/types";
import type { ExecutionQualityInput } from "./types";

export async function buildExecutionQualityInputServer(): Promise<ExecutionQualityInput> {
  const [testnetJournal, liveRows] = await Promise.all([
    loadServerBinanceTestnetJournal().catch(() => []),
    listWarehouseRows("live_trades", 300).catch(() => []),
  ]);

  const normalizedJournal = testnetJournal.map((entry) =>
    normalizeJournalEntry(entry),
  );

  const liveTrades = liveRows
    .map((row) => row.payload as unknown)
    .filter((payload): payload is LiveTradeJournalEntry => {
      if (!payload || typeof payload !== "object") return false;
      const rec = payload as Record<string, unknown>;
      return typeof rec.liveTradeId === "string" && typeof rec.status === "string";
    });

  return {
    testnetJournal: normalizedJournal,
    liveTrades,
  };
}

function normalizeJournalEntry(
  entry: BinanceTestnetJournalEntry,
): BinanceTestnetJournalEntry {
  const previewPrice = entry.previewPrice ?? entry.markPriceAtSubmit ?? null;
  const markPriceAtSubmit = entry.markPriceAtSubmit ?? entry.previewPrice ?? null;
  const fillPrice = entry.fillPrice ?? null;
  const slippage = entry.slippage ?? deriveSlippage(previewPrice, fillPrice);
  const slippageBps =
    entry.slippageBps ??
    (previewPrice && fillPrice
      ? Number((((fillPrice - previewPrice) / previewPrice) * 10_000).toFixed(3))
      : null);
  const latencyMs =
    entry.latencyMs ??
    deriveLatencyMs(entry.executedAt ?? null, entry.createdAt);

  return {
    ...entry,
    previewPrice,
    markPriceAtSubmit,
    fillPrice,
    slippage,
    slippageBps,
    latencyMs,
    partialFill: entry.partialFill ?? false,
    duplicateSubmission: entry.duplicateSubmission ?? false,
    retryCount: entry.retryCount ?? 0,
    closeAttempt: entry.closeAttempt ?? entry.binanceTestnetTradeId.includes("-close"),
    closeFailed:
      entry.closeFailed ??
      (entry.binanceTestnetTradeId.includes("-close") &&
        (entry.status === "FAILED" || entry.status === "BLOCKED")),
  };
}

function deriveSlippage(
  previewPrice: number | null,
  fillPrice: number | null,
): number | null {
  if (!previewPrice || !fillPrice) return null;
  return Number((fillPrice - previewPrice).toFixed(6));
}

function deriveLatencyMs(executedAt: string | null, createdAt: string): number | null {
  if (!executedAt) return null;
  const start = Date.parse(createdAt);
  const end = Date.parse(executedAt);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;
  return end - start;
}

