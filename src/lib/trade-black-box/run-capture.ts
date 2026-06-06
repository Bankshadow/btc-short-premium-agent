import { loadLedgerAnalyticsInput } from "@/lib/ledger/analytics";
import { loadServerBinanceTestnetJournal } from "@/lib/exchange/binance/binance-testnet-journal-server";
import { getStoredPreview } from "@/lib/exchange/binance/binance-order-preview";
import { loadServerAnalysisJournal } from "@/lib/journal/journal-server-store";
import { filterProductionEntries } from "@/lib/journal/production-filter";
import { buildTestnetMonitorSnapshot } from "@/lib/testnet-monitor";
import { loadMonitorJournalEvents } from "@/lib/testnet-monitor/monitor-journal-server";
import { getTradeQualityByDecisionId } from "@/lib/trade-quality-score/quality-store";
import { buildTradeBlackBox } from "./build-black-box";
import { loadTradeBlackBoxStore, upsertTradeBlackBoxRecord } from "./black-box-store";
import type { TradeBlackBoxRecord, TradeBlackBoxStatus } from "./types";
import { TRADE_BLACK_BOX_SAFETY_NOTICE } from "./types";

async function loadCaptureContext() {
  const { ledger } = loadLedgerAnalyticsInput();
  const [binanceJournal, testnetSnapshot, monitorEvents, journalEntries] =
    await Promise.all([
      loadServerBinanceTestnetJournal().catch(() => []),
      buildTestnetMonitorSnapshot().catch(() => null),
      loadMonitorJournalEvents().catch(() => []),
      loadServerAnalysisJournal().catch(() => []),
    ]);
  const entries = filterProductionEntries(journalEntries);
  const entryMap = new Map(entries.map((e) => [e.id, e]));
  return { ledger, binanceJournal, testnetSnapshot, monitorEvents, entryMap };
}

export async function captureTradeBlackBox(
  tradeId: string,
  workspaceId = "server-default",
): Promise<TradeBlackBoxRecord | null> {
  const ctx = await loadCaptureContext();
  const timelineTrade = ctx.ledger.tradeTimelines.find(
    (t) => t.tradeId === tradeId || t.decisionId === tradeId,
  );
  const lookupId = timelineTrade?.tradeId ?? tradeId;

  let preview = null;
  const binance = ctx.binanceJournal.find(
    (j) => j.binanceTestnetTradeId === lookupId || j.decisionLogId === tradeId,
  );
  if (binance?.previewId) {
    preview = await getStoredPreview(binance.previewId).catch(() => null);
  }

  const decisionLogId =
    timelineTrade?.decisionId ?? binance?.decisionLogId ?? null;
  const decision = decisionLogId ? ctx.entryMap.get(decisionLogId) ?? null : null;
  const tradeQuality = decisionLogId
    ? await getTradeQualityByDecisionId(decisionLogId, workspaceId)
    : null;

  const record = buildTradeBlackBox({
    lookupId,
    ledger: ctx.ledger,
    decision,
    testnetSnapshot: ctx.testnetSnapshot,
    binanceJournal: ctx.binanceJournal,
    monitorEvents: ctx.monitorEvents,
    preview,
    tradeQuality,
    workspaceId,
  });

  if (record) {
    await upsertTradeBlackBoxRecord(record, workspaceId);
  }
  return record;
}

export async function runTradeBlackBoxCapture(
  workspaceId = "server-default",
): Promise<{
  ok: boolean;
  captured: number;
  failed: number;
  safetyNotice: typeof TRADE_BLACK_BOX_SAFETY_NOTICE;
}> {
  const ctx = await loadCaptureContext();
  const tradeIds = new Set<string>();
  for (const t of ctx.ledger.tradeTimelines) {
    tradeIds.add(t.tradeId);
  }
  for (const j of ctx.binanceJournal) {
    tradeIds.add(j.binanceTestnetTradeId);
  }

  let captured = 0;
  let failed = 0;
  for (const tradeId of tradeIds) {
    const record = await captureTradeBlackBox(tradeId, workspaceId);
    if (record) captured += 1;
    else failed += 1;
  }

  return {
    ok: true,
    captured,
    failed,
    safetyNotice: TRADE_BLACK_BOX_SAFETY_NOTICE,
  };
}

export async function getTradeBlackBoxStatus(
  workspaceId = "server-default",
): Promise<TradeBlackBoxStatus> {
  const store = await loadTradeBlackBoxStore(workspaceId);
  const recentFailures = store.records
    .filter((r) => r.failureCause.category !== "NONE")
    .slice(0, 8);
  return {
    workspaceId,
    recordCount: store.records.length,
    lastCapturedAt: store.lastCapturedAt,
    recentFailures,
    safetyNotice: TRADE_BLACK_BOX_SAFETY_NOTICE,
  };
}
