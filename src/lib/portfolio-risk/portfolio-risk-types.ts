export type PortfolioRiskStatus = "OK" | "WARNING" | "BLOCKED";

export interface PortfolioRiskIssue {
  code: string;
  message: string;
  severity: "WARNING" | "BLOCK";
}

export interface PortfolioRiskReport {
  status: PortfolioRiskStatus;
  evaluatedAt: string;
  issues: PortfolioRiskIssue[];
  blocksExecution: boolean;
  dailyPnl: number;
  drawdownPct: number;
  openExposureUsd: number;
  openPositions: number;
  consecutiveLosses: number;
  cooldownUntil: string | null;
  message: string;
  liveLocked: true;
}
