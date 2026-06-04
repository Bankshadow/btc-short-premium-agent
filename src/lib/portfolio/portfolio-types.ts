import type { PaperPortfolioSummary } from "@/lib/paper/paper-order-types";

export type MilestoneStatus = "locked" | "in_progress" | "achieved";

export interface PortfolioMilestone {
  id: string;
  title: string;
  description: string;
  status: MilestoneStatus;
  achievedAt: string | null;
  /** 0–100 for in_progress */
  progressPct: number;
}

export interface DeskPortfolioSnapshot {
  generatedAt: string;
  paper: PaperPortfolioSummary;
  resolvedLogCount: number;
  netLogPaperPnlPct: number;
  milestones: PortfolioMilestone[];
  streakWins: number;
  streakLosses: number;
}
