import { isBinanceTestnetAutoExecuteEnabled } from "@/lib/exchange/binance/binance-config";
import type { AutomationJobType, AutomationModuleToggles } from "./types";

/** Primary automation loop — testnet perp is default when Binance autoexec is on. */
export type AutomationPrimaryMode = "testnet_perp" | "full_desk";

export function resolveAutomationPrimaryMode(): AutomationPrimaryMode {
  const raw = process.env.AUTOMATION_PRIMARY_MODE?.trim().toLowerCase();
  if (raw === "full_desk" || raw === "full" || raw === "desk") {
    return "full_desk";
  }
  if (raw === "testnet_perp" || raw === "testnet" || raw === "perp") {
    return "testnet_perp";
  }
  return isBinanceTestnetAutoExecuteEnabled() ? "testnet_perp" : "full_desk";
}

export function isTestnetPrimaryAutomation(): boolean {
  return resolveAutomationPrimaryMode() === "testnet_perp";
}

/** Lean spine — analyze → monitor → execute → learn → status. */
export const TESTNET_PRIMARY_AUTOMATION_JOBS: AutomationJobType[] = [
  "DESK_ANALYZE",
  "COMMAND_CENTER_REFRESH",
  "BINANCE_TESTNET_MONITOR",
  "BINANCE_TESTNET_AUTOEXECUTE",
  "LEARNING_UPDATE",
  "SELF_LEARNING_UPDATE",
];

export const FULL_DESK_AUTOMATION_JOBS: AutomationJobType[] = [
  "MARKET_SNAPSHOT",
  "PARALLEL_AGENT_REVIEW",
  "DESK_ANALYZE",
  "BINANCE_TESTNET_MONITOR",
  "BINANCE_TESTNET_AUTOEXECUTE",
  "SELF_LEARNING_UPDATE",
  "PAPER_MONITOR",
  "PORTFOLIO_SNAPSHOT",
  "LEARNING_UPDATE",
  "RISK_CHECK",
  "ACTION_QUEUE_REFRESH",
  "COMMAND_CENTER_REFRESH",
  "NOTIFICATION_DIGEST",
  "PROJECT_STRATEGIST_REVIEW",
  "SECOND_BRAIN_CONSOLIDATE",
  "DAILY_SELF_REVIEW",
  "CONFIDENCE_CALIBRATION_UPDATE",
  "TRADE_QUALITY_SCORE_UPDATE",
  "TRADE_BLACK_BOX_CAPTURE",
  "CONTINUOUS_IMPROVEMENT_DETECT",
];

export function resolveDefaultAutomationJobs(): AutomationJobType[] {
  return isTestnetPrimaryAutomation()
    ? [...TESTNET_PRIMARY_AUTOMATION_JOBS]
    : [...FULL_DESK_AUTOMATION_JOBS];
}

export function resolveTestnetPrimaryModuleToggles(
  base: AutomationModuleToggles,
): AutomationModuleToggles {
  return {
    ...base,
    MARKET_SNAPSHOT: false,
    PARALLEL_AGENT_REVIEW: false,
    PAPER_MONITOR: false,
    PORTFOLIO_SNAPSHOT: false,
    RISK_CHECK: false,
    ACTION_QUEUE_REFRESH: false,
    NOTIFICATION_DIGEST: false,
    PROJECT_STRATEGIST_REVIEW: false,
    SECOND_BRAIN_CONSOLIDATE: false,
    DAILY_SELF_REVIEW: false,
    CONFIDENCE_CALIBRATION_UPDATE: false,
    TRADE_QUALITY_SCORE_UPDATE: false,
    TRADE_BLACK_BOX_CAPTURE: false,
    CONTINUOUS_IMPROVEMENT_DETECT: false,
    DESK_ANALYZE: true,
    BINANCE_TESTNET_MONITOR: true,
    BINANCE_TESTNET_AUTOEXECUTE: true,
    LEARNING_UPDATE: true,
    SELF_LEARNING_UPDATE: true,
    COMMAND_CENTER_REFRESH: true,
  };
}
