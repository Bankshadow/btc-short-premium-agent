import type { AgentRecommendation } from "@/lib/agents/types";
import type { DeskRiskProfile } from "@/lib/desk/desk-risk-policy";
import type { PaperMode } from "@/lib/paper/paper-relaxed-types";

export type UnifiedBook = "btc_options" | "perp_directional";

export type UnifiedPositionStatus = "OPEN" | "CLOSED" | "CANCELLED";

export interface UnifiedPaperPosition {
  id: string;
  book: UnifiedBook;
  symbol: string;
  assetId: string | null;
  side: string;
  strategyName: string;
  sourceAgent: string;
  decisionLogId: string;
  verdict: AgentRecommendation;
  riskProfile: DeskRiskProfile;
  status: UnifiedPositionStatus;
  createdAt: string;
  closedAt: string | null;
  notionalUsd: number;
  sizePct: number;
  entryPrice: number;
  exitPrice: number | null;
  realizedPnlUsd: number;
  realizedPnlPct: number | null;
  unrealizedPnlUsd: number;
  unrealizedPnlPct: number | null;
  /** Original store reference for traceability */
  legacyRef: { book: UnifiedBook; id: string };
  notes: string;
  paperMode?: PaperMode;
  relaxedReason?: string | null;
}

export type UnifiedPaperTrade = UnifiedPaperPosition & {
  status: "CLOSED" | "CANCELLED";
};

export interface ExposureSlice {
  key: string;
  notionalUsd: number;
  pctOfBook: number;
  openCount: number;
}

export interface PnlSlice {
  key: string;
  realizedUsd: number;
  unrealizedUsd: number;
  totalUsd: number;
  tradeCount: number;
}

export interface EquityCurvePoint {
  at: string;
  equityUsd: number;
  cumulativePnlUsd: number;
}

export interface UnifiedPortfolioMetrics {
  baseEquityUsd: number;
  totalEquity: number;
  realizedPnlUsd: number;
  unrealizedPnlUsd: number;
  totalPnlUsd: number;
  realizedPnlPct: number;
  unrealizedPnlPct: number;
  totalPnlPct: number;
  openExposureUsd: number;
  openExposurePct: number;
  exposureByAsset: ExposureSlice[];
  exposureByStrategy: ExposureSlice[];
  winRate: number;
  averageWinPct: number;
  averageLossPct: number;
  maxDrawdownPct: number;
  maxDrawdownUsd: number;
  dailyPnlUsd: number;
  weeklyPnlUsd: number;
  openCount: number;
  closedCount: number;
  winCount: number;
  lossCount: number;
}

export interface UnifiedPortfolioSnapshot {
  generatedAt: string;
  metrics: UnifiedPortfolioMetrics;
  openPositions: UnifiedPaperPosition[];
  closedTrades: UnifiedPaperTrade[];
  equityCurve: EquityCurvePoint[];
  pnlByAsset: PnlSlice[];
  pnlByStrategy: PnlSlice[];
  migrationApplied: boolean;
}

export interface UnifiedPortfolioInput {
  entries?: import("@/lib/journal/decision-log-types").DecisionLogEntry[];
  orders?: import("@/lib/paper/paper-order-types").PaperOrder[];
  perpPositions?: import("@/lib/multi-asset/types").PerpPaperPosition[];
  riskProfile?: DeskRiskProfile;
  baseEquityUsd?: number;
}

export const UNIFIED_PORTFOLIO_BASE_EQUITY_USD = 10_000;
