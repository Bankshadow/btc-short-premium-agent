import type { OutcomeLabel } from "@/lib/journal/decision-log-types";
import type { PaperOrder } from "@/lib/paper/paper-order-types";

export type PaperAutopilotMode =
  | "OFF"
  | "SHADOW_ONLY"
  | "PAPER_ON_TRADE"
  | "PAPER_RELAXED"
  | "PAPER_STRICT";

export type PaperLifecycleStatus =
  | "CREATED"
  | "OPEN"
  | "MONITORING"
  | "CLOSE_RECOMMENDED"
  | "CLOSED"
  | "RESOLVED";

export type PaperAutopilotBook = "PAPER_STRICT" | "PAPER_SHADOW" | "DEMO";

export type PaperCreateAction = "NONE" | "CREATE_PAPER" | "CREATE_SHADOW";

export interface PaperLifecycleEvent {
  at: string;
  status: PaperLifecycleStatus;
  note: string;
}

export interface PaperLifecycleRecord {
  lifecycleId: string;
  tradeId: string;
  decisionLogId: string;
  book: PaperAutopilotBook;
  status: PaperLifecycleStatus;
  events: PaperLifecycleEvent[];
  closeRecommendation: string | null;
  monitorNotes: string[];
  markBtcPrice: number | null;
  unrealizedPnlPct: number | null;
  realizedPnlPct: number | null;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  resolvedAt: string | null;
  outcomeLabel: OutcomeLabel | null;
  rMultiple: number | null;
  resolutionNotes: string | null;
}

export interface PaperAutopilotSettings {
  mode: PaperAutopilotMode;
  autoResolveEnabled: boolean;
  autoCloseOnRecommendation: boolean;
  shadowMinConfidence: number;
  stopLossPct: number;
  takeProfitPct: number;
  maxPaperTradesPerDay: number;
  maxShadowTradesPerDay: number;
  lastRunAt: string | null;
}

export interface PaperCreateEvaluation {
  action: PaperCreateAction;
  reason: string;
  blocked: boolean;
  blockReason: string | null;
}

export interface PaperMonitorSignal {
  lifecycleId: string;
  tradeId: string;
  signal: "SL_HIT" | "TP_HIT" | "THESIS_INVALID" | "VERDICT_FLIP" | "MARK_UPDATE";
  detail: string;
  recommendClose: boolean;
}

export interface PaperAutopilotRunResult {
  runId: string;
  at: string;
  mode: PaperAutopilotMode;
  skipped: boolean;
  skipReason: string | null;
  created: PaperOrder[];
  monitored: number;
  closeRecommended: number;
  closed: number;
  resolved: number;
  pendingResolution: number;
  signals: PaperMonitorSignal[];
  createEvaluation: PaperCreateEvaluation | null;
  safetyNotice: string;
}
