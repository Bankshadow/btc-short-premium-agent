import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import type { PaperOrder } from "@/lib/paper/paper-order-types";
import type { PerpPaperPosition } from "@/lib/multi-asset/types";
import type { LiveTradeJournalEntry } from "@/lib/live-pilot/types";
import type { OptionsTestnetJournalEntry } from "@/lib/options-execution/types";
import type { BinanceTestnetJournalEntry } from "@/lib/exchange/binance/binance-types";

export type LedgerSourceType = "AI" | "USER" | "SYSTEM" | "EXCHANGE";

export type LedgerEnvironment = "DEMO" | "PAPER" | "SHADOW" | "TESTNET" | "LIVE";

export type LedgerEntryKind =
  | "DECISION"
  | "TRADE"
  | "ORDER"
  | "RISK"
  | "APPROVAL"
  | "PNL"
  | "AUDIT"
  | "CORRECTION";

export type TradeLifecycleStage =
  | "SIGNAL"
  | "PREVIEW"
  | "APPROVED"
  | "OPENED"
  | "MONITORING"
  | "CLOSE_RECOMMENDED"
  | "CLOSED"
  | "RESOLVED"
  | "LEARNED";

export type LedgerAssetClass =
  | "btc_options"
  | "perp_directional"
  | "options_testnet"
  | "binance_testnet"
  | "options_live"
  | "unknown";

export interface LedgerEntryBase {
  ledgerEntryId: string;
  workspaceId: string;
  entryKind: LedgerEntryKind;
  sourceType: LedgerSourceType;
  environment: LedgerEnvironment;
  linkedDecisionId: string | null;
  linkedTradeId: string | null;
  linkedOrderId: string | null;
  linkedRunId: string | null;
  timestamp: string;
  payload: Record<string, unknown>;
  hash: string;
  lifecycleStage?: TradeLifecycleStage;
  asset?: string;
  strategy?: string;
  assetClass?: LedgerAssetClass;
  /** Stable reference to originating store record */
  legacyRef?: { store: string; id: string };
  /** Points to corrected entry — corrections are append-only */
  correctionOf?: string;
}

export interface DecisionLedgerEntry extends LedgerEntryBase {
  entryKind: "DECISION";
  payload: { decision: DecisionLogEntry };
}

export interface TradeLedgerEntry extends LedgerEntryBase {
  entryKind: "TRADE";
  lifecycleStage: TradeLifecycleStage;
}

export interface OrderLedgerEntry extends LedgerEntryBase {
  entryKind: "ORDER";
  lifecycleStage: TradeLifecycleStage;
}

export interface RiskLedgerEntry extends LedgerEntryBase {
  entryKind: "RISK";
}

export interface ApprovalLedgerEntry extends LedgerEntryBase {
  entryKind: "APPROVAL";
  lifecycleStage: "APPROVED" | "PREVIEW";
}

export interface PnLLedgerEntry extends LedgerEntryBase {
  entryKind: "PNL";
  lifecycleStage: "CLOSED" | "RESOLVED" | "LEARNED";
}

export interface AuditLedgerEntry extends LedgerEntryBase {
  entryKind: "AUDIT";
}

export type LedgerEntry =
  | DecisionLedgerEntry
  | TradeLedgerEntry
  | OrderLedgerEntry
  | RiskLedgerEntry
  | ApprovalLedgerEntry
  | PnLLedgerEntry
  | AuditLedgerEntry
  | LedgerEntryBase;

export interface LedgerHealthReport {
  healthy: boolean;
  entryCount: number;
  liveEntryCount: number;
  orphanTrades: number;
  missingHashes: number;
  duplicateLegacyRefs: number;
  brokenLinks: number;
  issues: string[];
  lastSyncedAt: string | null;
}

export interface UnifiedLedgerSnapshot {
  workspaceId: string;
  generatedAt: string;
  entries: LedgerEntry[];
  health: LedgerHealthReport;
  tradeTimelines: TradeTimeline[];
}

export interface TradeTimeline {
  tradeId: string;
  decisionId: string | null;
  runId: string | null;
  environment: LedgerEnvironment;
  asset: string;
  strategy: string | null;
  assetClass: LedgerAssetClass;
  currentStage: TradeLifecycleStage;
  events: LedgerEntry[];
}

export interface LedgerSourceBundle {
  entries: DecisionLogEntry[];
  orders: PaperOrder[];
  perpPositions: PerpPaperPosition[];
  livePilotJournal: LiveTradeJournalEntry[];
  optionsTestnetJournal: OptionsTestnetJournalEntry[];
  binanceTestnetJournal: BinanceTestnetJournalEntry[];
}

export interface LedgerAnalyticsInput extends LedgerSourceBundle {
  ledger: UnifiedLedgerSnapshot;
  riskProfile: import("@/lib/desk/desk-risk-policy").DeskRiskProfile;
}
