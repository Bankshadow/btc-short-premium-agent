import type { DeskRiskProfile } from "@/lib/desk/desk-risk-policy";

export type RiskReplayEnvironment = "PAPER" | "TESTNET";
export type RiskReplaySide = "LONG" | "SHORT";

export interface RiskReplayPricePoint {
  timestamp: string;
  price: number;
}

export interface RiskReplayOriginalDecision {
  decisionLogId: string | null;
  finalVerdict: string | null;
  confidence: number | null;
  topReasons: string[];
}

export interface RiskReplayOriginalRiskSettings {
  profile: DeskRiskProfile;
  sizePct: number | null;
  maxRiskPct: number | null;
}

export interface RiskReplayStopTakeProfit {
  stopLoss: number | null;
  takeProfit: number | null;
}

export interface RiskReplayTradeInput {
  tradeId: string;
  environment: RiskReplayEnvironment;
  symbol: string;
  strategy: string | null;
  side: RiskReplaySide;
  quantity: number;
  notionalUsd: number;
  openedAt: string;
  closedAt: string;
  entryPrice: number;
  exitPrice: number;
  actualPnlUsd: number;
  originalDecision: RiskReplayOriginalDecision;
  originalRiskSettings: RiskReplayOriginalRiskSettings;
  originalStopTakeProfit: RiskReplayStopTakeProfit;
  marketPricePath: RiskReplayPricePoint[];
}

export type RiskReplayScenarioId =
  | "ACTUAL"
  | "SMALLER_SIZE"
  | "LARGER_SIZE_SIM_ONLY"
  | "EARLIER_EXIT"
  | "TRAILING_STOP"
  | "FIXED_STOP_LOSS"
  | "TAKE_PROFIT_1R"
  | "TAKE_PROFIT_2R"
  | "NO_TRADE"
  | "WAIT_FOR_CONFIRMATION";

export interface RiskReplayScenarioResult {
  scenarioId: RiskReplayScenarioId;
  label: string;
  simulated: boolean;
  pnlUsd: number;
  pnlPct: number;
  entryPrice: number;
  exitPrice: number;
  avoidedLoss: number;
  missedProfit: number;
  note: string;
}

export interface RiskReplayReport {
  trade: RiskReplayTradeInput;
  actualResult: RiskReplayScenarioResult;
  simulatedResults: RiskReplayScenarioResult[];
  avoidedLoss: number;
  missedProfit: number;
  recommendedRuleChange: string;
  confidence: number;
  riskNote: string;
}

export interface RiskReplayTradeOption {
  tradeId: string;
  environment: RiskReplayEnvironment;
  symbol: string;
  strategy: string | null;
  closedAt: string;
  actualPnlUsd: number;
  decisionLogId: string | null;
}
