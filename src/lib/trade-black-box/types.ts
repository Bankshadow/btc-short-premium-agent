export const TRADE_BLACK_BOX_SAFETY_NOTICE =
  "Trade black box records are debug-only — no API keys or secrets are stored. Records cannot authorize trades or change risk limits.";

export type BlackBoxFailureCategory =
  | "NONE"
  | "RISK_BLOCKED"
  | "PREVIEW_BLOCKED"
  | "AI_VETO"
  | "EXECUTION_FAILED"
  | "EXCHANGE_ERROR"
  | "CLOSE_FAILED"
  | "MONITOR_ERROR"
  | "UNKNOWN";

export type BlackBoxSection =
  | "MARKET_SNAPSHOT"
  | "AI_DECISION"
  | "AGENT_VOTES"
  | "RISK_CHECKS"
  | "PREVIEW"
  | "ORDER_REQUEST"
  | "EXCHANGE_RESPONSE"
  | "POSITION_UPDATES"
  | "CLOSE_EVENT"
  | "PNL"
  | "REFLECTION";

export type BlackBoxOutcomeStatus =
  | "OPEN"
  | "CLOSED"
  | "FAILED"
  | "BLOCKED"
  | "UNKNOWN";

export interface TradeBlackBoxTimelineEntry {
  entryId: string;
  section: BlackBoxSection;
  timestamp: string;
  actor: string;
  summary: string;
  data: Record<string, unknown>;
  hasError: boolean;
  error: string | null;
}

export interface TradeBlackBoxFailureCause {
  category: BlackBoxFailureCategory;
  headline: string;
  detail: string;
  evidence: string[];
  severity: "NONE" | "LOW" | "MEDIUM" | "HIGH";
}

export interface TradeBlackBoxSections {
  marketSnapshot: Record<string, unknown> | null;
  aiDecision: Record<string, unknown> | null;
  agentVotes: Record<string, unknown>[] | null;
  riskChecks: Record<string, unknown> | null;
  preview: Record<string, unknown> | null;
  orderRequest: Record<string, unknown> | null;
  exchangeResponse: Record<string, unknown> | null;
  positionUpdates: Record<string, unknown>[] | null;
  closeEvent: Record<string, unknown> | null;
  pnl: Record<string, unknown> | null;
  reflection: Record<string, unknown> | null;
}

export interface TradeBlackBoxRecord {
  blackBoxId: string;
  workspaceId: string;
  tradeId: string;
  decisionLogId: string | null;
  symbol: string | null;
  strategy: string | null;
  environment: string;
  capturedAt: string;
  updatedAt: string;
  outcomeStatus: BlackBoxOutcomeStatus;
  failureCause: TradeBlackBoxFailureCause;
  timeline: TradeBlackBoxTimelineEntry[];
  linkedIds: Record<string, string | null>;
  sections: TradeBlackBoxSections;
  tradeQualityGrade: string | null;
  safetyNotice: typeof TRADE_BLACK_BOX_SAFETY_NOTICE;
}

export interface TradeBlackBoxStore {
  workspaceId: string;
  records: TradeBlackBoxRecord[];
  lastCapturedAt: string | null;
  updatedAt: string;
}

export interface TradeBlackBoxStatus {
  workspaceId: string;
  recordCount: number;
  lastCapturedAt: string | null;
  recentFailures: TradeBlackBoxRecord[];
  safetyNotice: typeof TRADE_BLACK_BOX_SAFETY_NOTICE;
}

export interface TradeBlackBoxDebugPack {
  packVersion: "mvp-85-v1";
  generatedAt: string;
  tradeId: string;
  safetyNotice: typeof TRADE_BLACK_BOX_SAFETY_NOTICE;
  record: TradeBlackBoxRecord;
  secretsRedacted: true;
}
