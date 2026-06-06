import { loadDecisionLog } from "@/lib/journal/decision-log";
import { loadPaperOrders } from "@/lib/paper/paper-orders";
import { loadPerpPositions } from "@/lib/multi-asset/perp-paper-store";
import { loadLivePilotJournal } from "@/lib/live-pilot/journal-store";
import { loadOptionsTestnetJournal } from "@/lib/options-execution/testnet-journal-store";
import { loadBinanceTestnetJournalClient } from "@/lib/exchange/binance/binance-testnet-journal";
import { loadDeskSettings } from "@/lib/desk/desk-settings";
import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import type { PaperOrder } from "@/lib/paper/paper-order-types";
import type { PerpPaperPosition } from "@/lib/multi-asset/types";
import type { LiveTradeJournalEntry } from "@/lib/live-pilot/types";
import type { OptionsTestnetJournalEntry } from "@/lib/options-execution/types";
import type { BinanceTestnetJournalEntry } from "@/lib/exchange/binance/binance-types";
import { syncLedgerFromSources } from "./store";
import type { LedgerAnalyticsInput, LedgerSourceBundle, UnifiedLedgerSnapshot } from "./types";

export function loadLedgerSourceBundle(): LedgerSourceBundle {
  return {
    entries: loadDecisionLog(),
    orders: loadPaperOrders(),
    perpPositions: loadPerpPositions(),
    livePilotJournal: loadLivePilotJournal(),
    optionsTestnetJournal: loadOptionsTestnetJournal(),
    binanceTestnetJournal: loadBinanceTestnetJournalClient(),
  };
}

/** Extract canonical objects from ledger payloads for legacy analytics builders. */
export function extractSourcesFromLedger(snapshot: UnifiedLedgerSnapshot): LedgerSourceBundle {
  const entries: DecisionLogEntry[] = [];
  const orders: PaperOrder[] = [];
  const perpPositions: PerpPaperPosition[] = [];
  const livePilotJournal: LiveTradeJournalEntry[] = [];
  const optionsTestnetJournal: OptionsTestnetJournalEntry[] = [];
  const binanceTestnetJournal: BinanceTestnetJournalEntry[] = [];

  const seen = {
    decision: new Set<string>(),
    order: new Set<string>(),
    perp: new Set<string>(),
    live: new Set<string>(),
    options: new Set<string>(),
    binance: new Set<string>(),
  };

  for (const e of snapshot.entries) {
    const payload = e.payload as Record<string, unknown>;
    if (e.entryKind === "DECISION" && payload.decision) {
      const d = payload.decision as DecisionLogEntry;
      if (!seen.decision.has(d.id)) {
        seen.decision.add(d.id);
        entries.push(d);
      }
    }
    if (e.legacyRef?.store === "paper-orders" && payload.order) {
      const o = payload.order as PaperOrder;
      if (!seen.order.has(o.id)) {
        seen.order.add(o.id);
        orders.push(o);
      }
    }
    if (e.legacyRef?.store === "perp-paper" && payload.position) {
      const p = payload.position as PerpPaperPosition;
      if (!seen.perp.has(p.id)) {
        seen.perp.add(p.id);
        perpPositions.push(p);
      }
    }
    if (e.legacyRef?.store === "live-pilot-journal" && payload.liveTrade) {
      const l = payload.liveTrade as LiveTradeJournalEntry;
      if (!seen.live.has(l.liveTradeId)) {
        seen.live.add(l.liveTradeId);
        livePilotJournal.push(l);
      }
    }
    if (e.legacyRef?.store === "options-testnet-journal" && payload.optionsTestnet) {
      const o = payload.optionsTestnet as OptionsTestnetJournalEntry;
      if (!seen.options.has(o.optionsTestnetTradeId)) {
        seen.options.add(o.optionsTestnetTradeId);
        optionsTestnetJournal.push(o);
      }
    }
    if (e.legacyRef?.store === "binance-testnet-journal" && payload.binanceTestnet) {
      const b = payload.binanceTestnet as BinanceTestnetJournalEntry;
      if (!seen.binance.has(b.binanceTestnetTradeId)) {
        seen.binance.add(b.binanceTestnetTradeId);
        binanceTestnetJournal.push(b);
      }
    }
  }

  return {
    entries: entries.length > 0 ? entries : loadDecisionLog(),
    orders: orders.length > 0 ? orders : loadPaperOrders(),
    perpPositions: perpPositions.length > 0 ? perpPositions : loadPerpPositions(),
    livePilotJournal:
      livePilotJournal.length > 0 ? livePilotJournal : loadLivePilotJournal(),
    optionsTestnetJournal:
      optionsTestnetJournal.length > 0
        ? optionsTestnetJournal
        : loadOptionsTestnetJournal(),
    binanceTestnetJournal:
      binanceTestnetJournal.length > 0
        ? binanceTestnetJournal
        : loadBinanceTestnetJournalClient(),
  };
}

/** Canonical analytics read path — all dashboards should use this. */
export function loadLedgerAnalyticsInput(): LedgerAnalyticsInput {
  const bundle = loadLedgerSourceBundle();
  const ledger = syncLedgerFromSources(bundle);
  const sources = extractSourcesFromLedger(ledger);
  return {
    ...sources,
    ledger,
    riskProfile: loadDeskSettings().riskProfile,
  };
}
