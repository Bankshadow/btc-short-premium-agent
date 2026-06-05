import type { AgentRecommendation } from "@/lib/agents/types";
import type { HypotheticalAction } from "@/lib/types/market";
import type { PaperMode } from "./paper-relaxed-types";
import { DEFAULT_RELAXED_PAPER_SETTINGS } from "./paper-relaxed-types";

export type PaperOrderStatus = "OPEN" | "CLOSED" | "CANCELLED";

export type PaperInstrument = HypotheticalAction;

export interface PaperOrder {
  id: string;
  /** Links to decision log entry from same analyze run */
  decisionLogId: string;
  committeeVerdict: AgentRecommendation;
  instrument: PaperInstrument;
  symbol: string;
  side: "short" | "long" | "none";
  entryBtcPrice: number;
  entryOptionMark: number | null;
  strike: number | null;
  sizePct: number;
  /** Hypothetical notional for PnL display (USD) */
  notionalUsd: number;
  status: PaperOrderStatus;
  openedAt: string;
  closedAt: string | null;
  exitBtcPrice: number | null;
  realizedPnlPct: number | null;
  unrealizedPnlPct: number | null;
  lastMarkAt: string | null;
  lastMarkBtcPrice: number | null;
  openedBy: "committee_auto" | "manual" | "operator_approved" | "relaxed_auto";
  notes: string;
  supabaseId?: string;
  /** MVP 23 — paper mode trace */
  paperMode?: PaperMode;
  relaxedReason?: string | null;
  strictVerdict?: AgentRecommendation;
  relaxedVerdict?: AgentRecommendation;
}

export interface PaperTradingSettings {
  autoOpenOnTrade: boolean;
  autoMarkToMarket: boolean;
  syncSupabase: boolean;
  /** MVP 23 */
  paperMode: PaperMode;
  relaxedMinConfidence: number;
  relaxedMaxPositionSizePct: number;
  relaxedRequireOptionsAgentAgree: boolean;
  relaxedAllowWaitToPaperTrade: boolean;
}

export interface PaperPortfolioSummary {
  openCount: number;
  closedCount: number;
  totalRealizedPnlPct: number;
  totalUnrealizedPnlPct: number;
  winCount: number;
  lossCount: number;
}

export const PAPER_SETTINGS_STORAGE_KEY =
  "trading-agents-crypto-desk:paper-settings";

export const PAPER_ORDERS_STORAGE_KEY =
  "trading-agents-crypto-desk:paper-orders";

/** Hypothetical account size for % PnL → USD display */
export const PAPER_ACCOUNT_NOTIONAL_USD = 10_000;

export const DEFAULT_PAPER_SETTINGS: PaperTradingSettings = {
  autoOpenOnTrade: true,
  autoMarkToMarket: true,
  syncSupabase: true,
  ...DEFAULT_RELAXED_PAPER_SETTINGS,
};
