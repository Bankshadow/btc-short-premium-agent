import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import type { PaperOrder } from "@/lib/paper/paper-order-types";
import type { PerpPaperPosition } from "@/lib/multi-asset/types";
import type { LiveTradeJournalEntry } from "@/lib/live-pilot/types";
import type { OptionsTestnetJournalEntry } from "@/lib/options-execution/types";
import type { BinanceTestnetJournalEntry } from "@/lib/exchange/binance/binance-types";
import { getActiveWorkspaceId } from "@/lib/platform/workspace-registry";
import { hashLedgerPayload } from "./hash";
import {
  lifecycleFromBinanceTestnet,
  lifecycleFromDecision,
  lifecycleFromLiveTrade,
  lifecycleFromOptionsTestnet,
  lifecycleFromPaperOrder,
  lifecycleFromPerpPosition,
} from "./lifecycle";
import type {
  LedgerAssetClass,
  LedgerEntry,
  LedgerEnvironment,
  LedgerSourceType,
  LedgerSourceBundle,
  TradeLifecycleStage,
} from "./types";

function ledgerId(store: string, id: string, kind: string): string {
  return `led-${store}-${id}-${kind}`;
}

function envFromPaper(order: PaperOrder, entry?: DecisionLogEntry): LedgerEnvironment {
  if (order.isDemoData || entry?.isDemoData || entry?.analyzeStatus === "DEMO") {
    return "DEMO";
  }
  if (order.paperMode === "RELAXED_PAPER") return "SHADOW";
  return "PAPER";
}

function envFromDecision(entry: DecisionLogEntry): LedgerEnvironment {
  if (entry.isDemoData || entry.analyzeStatus === "DEMO") return "DEMO";
  return "PAPER";
}

function envFromLive(entry: LiveTradeJournalEntry): LedgerEnvironment {
  if (entry.pilotMode === "LIVE_TESTNET") return "TESTNET";
  return "LIVE";
}

function strategyFromDecision(entry: DecisionLogEntry): string {
  const top = entry.agentOutputs[0];
  return top?.strategyType ?? entry.marketRegime ?? "desk";
}

function makeEntry(
  partial: Omit<LedgerEntry, "hash"> & { payload: Record<string, unknown> },
): LedgerEntry {
  return {
    ...partial,
    hash: hashLedgerPayload(partial.payload),
  };
}

export function mapDecisionToLedger(entry: DecisionLogEntry, workspaceId: string): LedgerEntry {
  const payload = { decision: entry };
  return makeEntry({
    ledgerEntryId: ledgerId("decision-log", entry.id, "DECISION"),
    workspaceId: entry.workspaceId ?? workspaceId,
    entryKind: "DECISION",
    sourceType: "AI",
    environment: envFromDecision(entry),
    linkedDecisionId: entry.id,
    linkedTradeId: null,
    linkedOrderId: null,
    linkedRunId: entry.runId ?? null,
    timestamp: entry.timestamp,
    lifecycleStage: lifecycleFromDecision(entry),
    asset: "BTC",
    strategy: strategyFromDecision(entry),
    assetClass: "btc_options",
    legacyRef: { store: "decision-log", id: entry.id },
    payload,
  });
}

export function mapPaperOrderToLedger(
  order: PaperOrder,
  entries: DecisionLogEntry[],
  workspaceId: string,
): LedgerEntry[] {
  const entry = entries.find((e) => e.id === order.decisionLogId);
  const env = envFromPaper(order, entry);
  const tradeId = order.id;
  const base = {
    workspaceId: order.workspaceId ?? workspaceId,
    environment: env,
    linkedDecisionId: order.decisionLogId,
    linkedTradeId: tradeId,
    linkedOrderId: order.id,
    linkedRunId: entry?.runId ?? null,
    asset: order.symbol,
    strategy: order.instrument,
    assetClass: "btc_options" as LedgerAssetClass,
    legacyRef: { store: "paper-orders", id: order.id },
  };

  const tradePayload = { order, entry: entry ?? null };
  const trade = makeEntry({
    ...base,
    ledgerEntryId: ledgerId("paper-orders", order.id, "TRADE"),
    entryKind: "TRADE",
    sourceType: order.openedBy === "manual" ? "USER" : "AI",
    timestamp: order.openedAt,
    lifecycleStage: lifecycleFromPaperOrder(order),
    payload: tradePayload,
  });

  const orderEntry = makeEntry({
    ...base,
    ledgerEntryId: ledgerId("paper-orders", order.id, "ORDER"),
    entryKind: "ORDER",
    sourceType: order.openedBy === "manual" ? "USER" : "SYSTEM",
    timestamp: order.openedAt,
    lifecycleStage: order.status === "OPEN" ? "OPENED" : lifecycleFromPaperOrder(order),
    payload: tradePayload,
  });

  const result: LedgerEntry[] = [trade, orderEntry];

  if (order.status === "CLOSED" && order.realizedPnlPct != null) {
    result.push(
      makeEntry({
        ...base,
        ledgerEntryId: ledgerId("paper-orders", order.id, "PNL"),
        entryKind: "PNL",
        sourceType: "SYSTEM",
        timestamp: order.closedAt ?? order.openedAt,
        lifecycleStage: "CLOSED",
        payload: {
          realizedPnlPct: order.realizedPnlPct,
          notionalUsd: order.notionalUsd,
          order,
        },
      }),
    );
  }

  if (entry?.outcomeStatus === "RESOLVED") {
    result.push(
      makeEntry({
        ...base,
        ledgerEntryId: ledgerId("decision-log", entry.id, "LEARNED"),
        entryKind: "PNL",
        sourceType: "SYSTEM",
        timestamp: entry.resolution?.resolvedAt ?? entry.timestamp,
        lifecycleStage: entry.learningSnapshot ? "LEARNED" : "RESOLVED",
        payload: {
          resolution: entry.resolution,
          learningSnapshot: entry.learningSnapshot,
          decision: entry,
        },
      }),
    );
  }

  return result;
}

export function mapPerpToLedger(
  pos: PerpPaperPosition,
  workspaceId: string,
): LedgerEntry {
  const env: LedgerEnvironment = "PAPER";
  const payload = { position: pos };
  return makeEntry({
    ledgerEntryId: ledgerId("perp-paper", pos.id, "TRADE"),
    workspaceId,
    entryKind: "TRADE",
    sourceType: pos.openedBy === "manual" ? "USER" : "AI",
    environment: env,
    linkedDecisionId: pos.decisionLogId ?? null,
    linkedTradeId: pos.id,
    linkedOrderId: null,
    linkedRunId: null,
    timestamp: pos.openedAt,
    lifecycleStage: lifecycleFromPerpPosition(pos),
    asset: pos.symbol,
    strategy: pos.strategyName ?? pos.sourceAgent ?? "perp_directional",
    assetClass: "perp_directional",
    legacyRef: { store: "perp-paper", id: pos.id },
    payload,
  });
}

export function mapLiveTradeToLedger(
  entry: LiveTradeJournalEntry,
  workspaceId: string,
): LedgerEntry[] {
  const env = envFromLive(entry);
  const base = {
    workspaceId,
    environment: env,
    linkedDecisionId: entry.decisionLogId,
    linkedTradeId: entry.liveTradeId,
    linkedOrderId: entry.exchangeOrderId,
    linkedRunId: null,
    asset: entry.symbol,
    strategy: "live_perp_pilot",
    assetClass: "perp_directional" as LedgerAssetClass,
    legacyRef: { store: "live-pilot-journal", id: entry.liveTradeId },
  };
  const payload = { liveTrade: entry };

  const entries: LedgerEntry[] = [
    makeEntry({
      ...base,
      ledgerEntryId: ledgerId("live-pilot-journal", entry.liveTradeId, "TRADE"),
      entryKind: "TRADE",
      sourceType: entry.operatorApproval ? "USER" : "EXCHANGE",
      timestamp: entry.createdAt,
      lifecycleStage: lifecycleFromLiveTrade(entry),
      payload,
    }),
  ];

  if (entry.operatorApproval) {
    entries.push(
      makeEntry({
        ...base,
        ledgerEntryId: ledgerId("live-pilot-journal", entry.liveTradeId, "APPROVAL"),
        entryKind: "APPROVAL",
        sourceType: "USER",
        timestamp: entry.executedAt ?? entry.createdAt,
        lifecycleStage: "APPROVED",
        payload: {
          operatorApprovalNote: entry.operatorApprovalNote,
          liveTrade: entry,
        },
      }),
    );
  }

  if (entry.realizedPnl != null && entry.closedAt) {
    entries.push(
      makeEntry({
        ...base,
        ledgerEntryId: ledgerId("live-pilot-journal", entry.liveTradeId, "PNL"),
        entryKind: "PNL",
        sourceType: "EXCHANGE",
        timestamp: entry.closedAt,
        lifecycleStage: "CLOSED",
        payload: {
          realizedPnl: entry.realizedPnl,
          fees: entry.fees,
          liveTrade: entry,
        },
      }),
    );
  }

  return entries;
}

export function mapBinanceTestnetToLedger(
  entry: BinanceTestnetJournalEntry,
  workspaceId: string,
): LedgerEntry {
  const payload = { binanceTestnet: entry };
  return makeEntry({
    ledgerEntryId: ledgerId("binance-testnet", entry.binanceTestnetTradeId, "TRADE"),
    workspaceId,
    entryKind: "TRADE",
    sourceType: "EXCHANGE",
    environment: "TESTNET",
    linkedDecisionId: entry.decisionLogId,
    linkedTradeId: entry.binanceTestnetTradeId,
    linkedOrderId: entry.exchangeOrderId,
    linkedRunId: null,
    timestamp: entry.createdAt,
    lifecycleStage: lifecycleFromBinanceTestnet(entry),
    asset: entry.symbol,
    strategy: entry.source,
    assetClass: "binance_testnet",
    legacyRef: { store: "binance-testnet-journal", id: entry.binanceTestnetTradeId },
    payload,
  });
}

export function mapOptionsTestnetToLedger(
  entry: OptionsTestnetJournalEntry,
  workspaceId: string,
): LedgerEntry {
  const payload = { optionsTestnet: entry };
  return makeEntry({
    ledgerEntryId: ledgerId("options-testnet", entry.optionsTestnetTradeId, "TRADE"),
    workspaceId,
    entryKind: "TRADE",
    sourceType: "EXCHANGE",
    environment: "TESTNET",
    linkedDecisionId: entry.decisionLogId,
    linkedTradeId: entry.optionsTestnetTradeId,
    linkedOrderId: entry.exchangeOrderId,
    linkedRunId: null,
    timestamp: entry.createdAt,
    lifecycleStage: lifecycleFromOptionsTestnet(entry),
    asset: entry.symbol,
    strategy: entry.instrument,
    assetClass: "options_testnet",
    legacyRef: { store: "options-testnet-journal", id: entry.optionsTestnetTradeId },
    payload,
  });
}

export function buildLedgerEntriesFromSources(
  bundle: LedgerSourceBundle,
  workspaceId?: string,
): LedgerEntry[] {
  const ws = workspaceId ?? getActiveWorkspaceId();
  const byId = new Map<string, LedgerEntry>();

  for (const entry of bundle.entries) {
    const led = mapDecisionToLedger(entry, ws);
    byId.set(led.ledgerEntryId, led);
  }

  for (const order of bundle.orders) {
    for (const led of mapPaperOrderToLedger(order, bundle.entries, ws)) {
      byId.set(led.ledgerEntryId, led);
    }
  }

  for (const pos of bundle.perpPositions) {
    const led = mapPerpToLedger(pos, ws);
    byId.set(led.ledgerEntryId, led);
  }

  for (const live of bundle.livePilotJournal) {
    for (const led of mapLiveTradeToLedger(live, ws)) {
      byId.set(led.ledgerEntryId, led);
    }
  }

  for (const opt of bundle.optionsTestnetJournal) {
    const led = mapOptionsTestnetToLedger(opt, ws);
    byId.set(led.ledgerEntryId, led);
  }

  for (const bn of bundle.binanceTestnetJournal) {
    const led = mapBinanceTestnetToLedger(bn, ws);
    byId.set(led.ledgerEntryId, led);
  }

  return [...byId.values()].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );
}
