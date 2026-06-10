import type { MissionMode } from "@/lib/mission-controller-risk-budget/types";

/** MVP 93 — always-on operator layer (monitoring without opening orders). */
export const ALWAYS_ON_OPERATOR_LAYER_MVP = 93 as const;
export const ALWAYS_ON_OPERATOR_LAYER_LABEL = "Always-on Operator Layer";

export const OPERATOR_LAYER_SAFETY_NOTICE =
  "Operator layer monitors and reports only. Heartbeat cannot open orders. Telegram cannot enable live trading. Testnet execute still requires double-confirm approval.";

export type OperatorLayerTickStep =
  | "heartbeat"
  | "refresh_market_data"
  | "refresh_positions"
  | "update_pnl"
  | "check_risk"
  | "detect_stuck_position"
  | "detect_missing_journal"
  | "generate_daily_report"
  | "telegram_notify";

export type OperatorLayerAlertKind =
  | "action_required"
  | "stuck_position"
  | "missing_journal"
  | "risk_elevated"
  | "monitor_stale"
  | "mission_paused"
  | "permission_pending";

export interface OperatorLayerStepResult {
  step: OperatorLayerTickStep;
  ok: boolean;
  summary: string;
  durationMs: number;
}

export interface OperatorLayerAlert {
  alertId: string;
  kind: OperatorLayerAlertKind;
  severity: "INFO" | "WARNING" | "CRITICAL";
  title: string;
  message: string;
  symbol: string | null;
}

export interface OperatorLayerHeartbeat {
  lastTickAt: string | null;
  lastSuccessfulTickAt: string | null;
  tickCount: number;
  lastMarketRefreshAt: string | null;
  lastPositionRefreshAt: string | null;
  lastPnlUpdateAt: string | null;
  lastRiskCheckAt: string | null;
  lastDailyReportAt: string | null;
  lastTelegramNotifyAt: string | null;
  lastAlertFingerprint: string | null;
  updatedAt: string;
}

export interface AlwaysOnOperatorLayerSnapshot {
  mvp: typeof ALWAYS_ON_OPERATOR_LAYER_MVP;
  label: typeof ALWAYS_ON_OPERATOR_LAYER_LABEL;
  trigger: "cron" | "automation" | "manual";
  heartbeat: OperatorLayerHeartbeat;
  steps: OperatorLayerStepResult[];
  alerts: OperatorLayerAlert[];
  actionRequired: boolean;
  nextAction: string;
  btcPrice: number | null;
  openPositionCount: number;
  dailyPnlUsd: number;
  netPnlUsd: number;
  missionMode: MissionMode | null;
  dailyReportGenerated: boolean;
  dailyReportSummary: string | null;
  telegramNotified: boolean;
  cannotOpenOrders: true;
  telegramCannotEnableLive: true;
  testnetExecuteRequiresApproval: true;
  safetyNotice: typeof OPERATOR_LAYER_SAFETY_NOTICE;
  lastUpdatedAt: string;
}

export interface OperatorLayerTickInput {
  trigger?: "cron" | "automation" | "manual";
  /** When true, attempt end-of-day report if not yet run today. */
  allowDailyReport?: boolean;
  workspaceId?: string;
}
