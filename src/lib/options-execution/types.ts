import type { HypotheticalAction, OptionCandidate } from "@/lib/types/market";
import type { OrderTicket } from "@/lib/trade-control/trade-control-types";

export type OptionsRiskStatus = "PASS" | "WARNING" | "FAIL";

export interface OptionsInstrument {
  symbol: string;
  base: string;
  strike: number;
  expiry: string;
  expiryTimeMs: number;
  optionType: "call" | "put";
  bid: number;
  ask: number;
  markPrice: number;
  spreadPct: number;
  delta: number;
  iv: number;
  mapped: boolean;
  mappingErrors: string[];
}

export interface OptionsOrderTicket {
  ticketId: string;
  decisionLogId: string;
  instrument: HypotheticalAction;
  optionsInstrument: OptionsInstrument;
  side: "short" | "long";
  contracts: number;
  limitPrice: number;
  notionalUsd: number;
  positionSizePct: number;
  stopLossIndex: number;
  takeProfitIndex: number | null;
  generatedAt: string;
  sourceTicket: OrderTicket;
}

export interface OptionsMarginEstimate {
  estimatedMarginUsd: number;
  marginUsagePct: number | null;
  availableBalanceUsd: number | null;
  sufficient: boolean | null;
}

export interface OptionsExpiryPlan {
  expiryDate: string;
  expiryTimeMs: number;
  hoursToExpiry: number;
  settlementTimeTh: string;
  pinExitTimeTh: string;
  proximityWarning: boolean;
}

export interface OptionsRiskCheck {
  id: string;
  label: string;
  status: OptionsRiskStatus;
  message: string;
  blocking: boolean;
}

export interface OptionsOrderPreview {
  previewId: string;
  valid: boolean;
  previewOnly: true;
  realExecutionDisabled: true;
  ticket: OptionsOrderTicket | null;
  estimatedPremiumUsd: number;
  estimatedMaxLossUsd: number;
  estimatedBreakevenIndex: number | null;
  margin: OptionsMarginEstimate;
  expiryPlan: OptionsExpiryPlan | null;
  assignmentRisk: string;
  settlementRisk: string;
  liquidityRisk: string;
  slippageRisk: string;
  riskChecks: OptionsRiskCheck[];
  blockingReasons: string[];
  warnings: string[];
  bybitPayload: Record<string, unknown> | null;
  disclaimer: string;
  generatedAt: string;
}

export interface OptionsExecutionStatus {
  testnetEnabled: boolean;
  liveEnabled: boolean;
  liveImplemented: false;
  previewOnly: true;
  network: "testnet" | "mainnet" | null;
  configured: boolean;
  safetyNotice: string;
}

export type OptionsPreviewJournalStatus =
  | "PREVIEWED"
  | "REJECTED"
  | "TESTNET_SIMULATED"
  | "BLOCKED_LIVE_ATTEMPT";

export interface OptionsPreviewJournalEntry {
  id: string;
  previewId: string;
  decisionLogId: string;
  symbol: string;
  instrument: HypotheticalAction;
  status: OptionsPreviewJournalStatus;
  valid: boolean;
  estimatedPremiumUsd: number;
  blockingReasons: string[];
  paperOrderLinked: boolean;
  paperOrderId: string | null;
  createdAt: string;
  operatorNote: string | null;
}

export type OptionsTestnetTradeStatus =
  | "PENDING"
  | "SUBMITTED"
  | "OPEN"
  | "FILLED"
  | "CLOSING"
  | "CLOSED"
  | "FAILED"
  | "BLOCKED"
  | "RECONCILED";

export interface OptionsTestnetJournalEntry {
  optionsTestnetTradeId: string;
  decisionLogId: string;
  previewId: string;
  instrument: HypotheticalAction;
  side: "short" | "long";
  qty: number;
  premium: number;
  marginEstimateUsd: number;
  status: OptionsTestnetTradeStatus;
  exchangeOrderId: string | null;
  symbol: string;
  createdAt: string;
  executedAt: string | null;
  closedAt: string | null;
  operatorNote: string | null;
  error: string | null;
}

export interface OptionsTestnetClosePreview {
  previewId: string;
  optionsTestnetTradeId: string;
  symbol: string;
  positionSide: "Buy" | "Sell";
  qty: number;
  estExitPrice: number;
  estPremiumUsd: number;
  reduceOnly: true;
  requiresHumanApproval: true;
  disclaimer: string;
}

export interface OptionsTestnetReconcileReport {
  reconciledAt: string;
  journalCount: number;
  openPositions: number;
  openOrders: number;
  mismatches: string[];
  updatedEntries: OptionsTestnetJournalEntry[];
}
