import type { AlwaysOnOperatorLayerSnapshot } from "./types";
import {
  ALWAYS_ON_OPERATOR_LAYER_LABEL,
  ALWAYS_ON_OPERATOR_LAYER_MVP,
  OPERATOR_LAYER_SAFETY_NOTICE,
} from "./types";

/** Client-safe empty state — no filesystem imports. */
export function emptyAlwaysOnOperatorLayer(): AlwaysOnOperatorLayerSnapshot {
  const heartbeat = {
    lastTickAt: null,
    lastSuccessfulTickAt: null,
    tickCount: 0,
    lastMarketRefreshAt: null,
    lastPositionRefreshAt: null,
    lastPnlUpdateAt: null,
    lastRiskCheckAt: null,
    lastDailyReportAt: null,
    lastTelegramNotifyAt: null,
    lastAlertFingerprint: null,
    updatedAt: new Date().toISOString(),
  };

  return {
    mvp: ALWAYS_ON_OPERATOR_LAYER_MVP,
    label: ALWAYS_ON_OPERATOR_LAYER_LABEL,
    trigger: "manual",
    heartbeat,
    steps: [],
    alerts: [],
    actionRequired: false,
    nextAction: "Operator layer idle — awaiting first cron tick.",
    btcPrice: null,
    openPositionCount: 0,
    dailyPnlUsd: 0,
    netPnlUsd: 0,
    missionMode: null,
    dailyReportGenerated: false,
    dailyReportSummary: null,
    telegramNotified: false,
    cannotOpenOrders: true,
    telegramCannotEnableLive: true,
    testnetExecuteRequiresApproval: true,
    safetyNotice: OPERATOR_LAYER_SAFETY_NOTICE,
    lastUpdatedAt: new Date().toISOString(),
  };
}
