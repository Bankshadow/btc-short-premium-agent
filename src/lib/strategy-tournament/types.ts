import type {
  QuantBacktestMetrics,
  QuantBacktestSymbol,
  QuantBacktestTimeframe,
  QuantEquityPoint,
  QuantFrictionAssumptions,
  QuantLiquidityWarning,
} from "@/lib/quant-backtest/types";

export const TOURNAMENT_SAFETY_NOTICE =
  "Strategy tournaments are simulation-only. Rankings cannot create orders or auto-promote to testnet without human approval.";

export type TournamentClassification =
  | "CANDIDATE_TESTNET"
  | "FILTER_ONLY"
  | "REJECT"
  | "NEEDS_MORE_DATA";

export interface TournamentRankingMetrics {
  netReturnScore: number;
  maxDrawdownScore: number;
  winRateScore: number;
  profitFactorScore: number;
  tradeFrequencyScore: number;
  stabilityScore: number;
  simplicityScore: number;
  executionRiskScore: number;
  compositeScore: number;
}

export interface TournamentContestantMeta {
  sourceId: string;
  strategyName: string;
  category: string;
  /** 0–100 — higher = simpler rule set. */
  simplicity: number;
  /** 0–100 — higher = safer to execute (lower tail risk). */
  executionRisk: number;
  suggestedRole: "ENTRY" | "EXIT" | "FILTER" | "DESK_PRIMARY";
}

export interface TournamentEntry {
  sourceId: string;
  strategyName: string;
  rank: number;
  metrics: QuantBacktestMetrics;
  ranking: TournamentRankingMetrics;
  classification: TournamentClassification;
  classificationSummary: string;
  rejectionReasons: string[];
  tradeFrequencyPer100Bars: number;
  equityCurve: QuantEquityPoint[];
}

export interface TournamentInput {
  symbol: QuantBacktestSymbol;
  timeframe: QuantBacktestTimeframe;
  startDate: string;
  endDate: string;
  friction: QuantFrictionAssumptions;
}

export interface TournamentResult {
  tournamentId: string;
  symbol: QuantBacktestSymbol;
  timeframe: QuantBacktestTimeframe;
  startDate: string;
  endDate: string;
  barsLoaded: number;
  friction: QuantFrictionAssumptions;
  liquidityWarning: QuantLiquidityWarning;
  entries: TournamentEntry[];
  winner: TournamentEntry | null;
  simulationOnly: true;
  cannotCreateOrders: true;
  cannotPromoteTestnetWithoutApproval: true;
  completedAt: string;
}

export interface PromoteTournamentWinnerInput {
  sourceId: string;
  humanApproval: boolean;
  operatorNote?: string;
}
