import type { PerpAssetId } from "./asset-config";
import type { PerpDirection, SignalConfidence } from "./types";

export type TimeframeHorizon = "SHORT" | "MEDIUM" | "LONG";

export interface TimeframeChartSignal {
  assetId: PerpAssetId;
  symbol: string;
  label: string;
  horizon: TimeframeHorizon;
  /** Human label e.g. "1H scalp", "4H swing", "1D position". */
  horizonLabel: string;
  price: number;
  trend: "bullish" | "bearish" | "neutral";
  rsi14: number;
  macdHistogram: number;
  atr: number;
  score: number;
  direction: PerpDirection;
  confidence: SignalConfidence;
  actionable: boolean;
  stopLoss: number | null;
  takeProfit: number | null;
  reasons: string[];
  risks: string[];
  dataFresh: boolean;
  error?: string;
}

export interface MultiTimeframeScanResult {
  generatedAt: string;
  signals: TimeframeChartSignal[];
  actionableCount: number;
  confluenceCount: number;
  errorCount: number;
  disclaimer: string;
}
