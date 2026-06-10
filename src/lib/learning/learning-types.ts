import type { TradeResult } from "@/lib/pnl/pnl-types";

export interface LearningRecord {
  learningId: string;
  tradeId: string;
  runId: string;
  decisionLogId: string;
  symbol: string;
  tradeResult: TradeResult;
  realizedPnl: number;
  originalThesis: string;
  actualOutcome: string;
  whatWorked: string;
  whatFailed: string;
  riskNotes: string;
  executionNotes: string;
  avoidNextTime: string;
  repeatNextTime: string;
  confidenceAdjustment: number;
  createdAt: string;
}

export interface CreateLearningResult {
  ok: boolean;
  record: LearningRecord | null;
  message: string;
  alreadyExists?: boolean;
}
