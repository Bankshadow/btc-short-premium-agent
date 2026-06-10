import type { AnalysisVerdict } from "@/lib/analysis/analysis-types";

export const DEFAULT_START_CAPITAL = 1000;
export const DEFAULT_TARGET_CAPITAL = 10_000;

export interface MissionSnapshot {
  generatedAt: string;
  startCapital: number;
  targetCapital: number;
  currentEquity: number;
  progressPct: number;
  totalTrades: number;
  win: number;
  loss: number;
  breakeven: number;
  netPnl: number;
  openPositions: number;
  latestRunId: string | null;
  latestDecisionLogId: string | null;
  latestVerdict: AnalysisVerdict | null;
  latestConfidence: number | null;
  latestVerdictReasons: string[];
  liveLocked: true;
}
