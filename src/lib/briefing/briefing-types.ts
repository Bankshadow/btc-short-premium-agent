import type { MissionSnapshot } from "@/lib/mission/mission-types";
import type { OperatorStatus } from "@/lib/operator/operator-types";

export interface DailyBriefing {
  briefingId: string;
  createdAt: string;
  mission: MissionSnapshot;
  binanceStatus: string;
  openPositionsCount: number;
  closedTradesCount: number;
  totalNetPnl: number;
  learningHighlights: string[];
  riskState: string;
  operatorActions: string[];
  nextRecommendedAction: string;
  liveLocked: true;
}

export interface ReplayStep {
  phase: string;
  eventType: string;
  timestamp: string;
  summary: string;
}

export interface SessionReplay {
  sessionId: string;
  tradeId: string | null;
  runId: string | null;
  createdAt: string;
  steps: ReplayStep[];
  liveLocked: true;
}

export interface ReplaySessionSummary {
  sessionId: string;
  tradeId: string | null;
  runId: string | null;
  createdAt: string;
  stepCount: number;
}
