import { getOptionsExecutionStatus, loadOptionsExecutionConfig } from "./config";
import type { OptionsExecutionStatus } from "./types";

export interface OptionsLiveReadinessReport {
  generatedAt: string;
  overallStatus: "PASS" | "WARNING" | "FAIL";
  checks: Array<{
    label: string;
    status: "PASS" | "WARNING" | "FAIL";
    message: string;
  }>;
  executionStatus: OptionsExecutionStatus;
  recommendedActions: string[];
  previewOnlyNotice: string;
}

export function buildOptionsLiveReadinessReport(): OptionsLiveReadinessReport {
  const config = loadOptionsExecutionConfig();
  const status = getOptionsExecutionStatus();
  const checks: OptionsLiveReadinessReport["checks"] = [];
  const actions: string[] = [];

  checks.push({
    label: "Real options live implemented",
    status: "FAIL",
    message: "Not implemented — MVP 36. Preview/testnet sim only.",
  });
  actions.push("Use preview layer until MVP 36 ships.");

  checks.push({
    label: "OPTIONS_LIVE_ENABLED",
    status: config.liveEnabled ? "FAIL" : "PASS",
    message: config.liveEnabled
      ? "Set OPTIONS_LIVE_ENABLED=false until MVP 36."
      : "Off (safe).",
  });

  checks.push({
    label: "OPTIONS_TESTNET_ENABLED",
    status: config.testnetEnabled ? "WARNING" : "PASS",
    message: config.testnetEnabled
      ? "Testnet simulation enabled — still no real orders."
      : "Off — enable only for testnet prep drills.",
  });

  checks.push({
    label: "Exchange configured",
    status: status.configured ? "PASS" : "FAIL",
    message: status.configured
      ? `Connected (${status.network ?? "unknown"}).`
      : "Missing BYBIT_API_KEY / SECRET.",
  });

  checks.push({
    label: "OPTIONS_NAKED_ALLOWED",
    status: config.nakedAllowed ? "WARNING" : "FAIL",
    message: config.nakedAllowed
      ? "Naked short allowed for testnet prep."
      : "Must set OPTIONS_NAKED_ALLOWED=true for short premium preview execute path.",
  });

  if (!status.configured) {
    actions.push("Configure Bybit testnet credentials.");
  }
  if (!config.nakedAllowed) {
    actions.push("Set OPTIONS_NAKED_ALLOWED=true after risk review for short premium.");
  }

  const failCount = checks.filter((c) => c.status === "FAIL").length;
  const warnCount = checks.filter((c) => c.status === "WARNING").length;
  const overallStatus: OptionsLiveReadinessReport["overallStatus"] =
    config.liveEnabled ? "FAIL" : failCount > 2 ? "FAIL" : warnCount > 0 ? "WARNING" : "PASS";

  return {
    generatedAt: new Date().toISOString(),
    overallStatus,
    checks,
    executionStatus: status,
    recommendedActions: actions,
    previewOnlyNotice:
      "Preview only — real BTC options live disabled. Compare paper trades on desk with options preview panel.",
  };
}
