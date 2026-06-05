import { buildOptionsDryRunPerformanceReport } from "@/lib/options-dry-run/build-performance-report";
import type { OptionsDryRunResult } from "@/lib/options-dry-run/types";
import type { OptionsRiskReport } from "@/lib/options-risk-greeks/types";
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
  dryRunGate: {
    sampleSize: number;
    wouldSubmitRatePct: number;
    readyForLiveGate: boolean;
    blockers: string[];
  } | null;
  optionsRiskGate: {
    overallStatus: "PASS" | "WARNING" | "FAIL";
    greeksEstimable: boolean;
    marginEstimable: boolean;
    liveReadinessBlocked: boolean;
    netDelta: number;
    marginUsagePct: number | null;
    blockers: string[];
  } | null;
}

export function buildOptionsLiveReadinessReport(input?: {
  dryRunHistory?: OptionsDryRunResult[];
  optionsRiskReport?: OptionsRiskReport | null;
}): OptionsLiveReadinessReport {
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

  const dryRunPerf = input?.dryRunHistory
    ? buildOptionsDryRunPerformanceReport({ history: input.dryRunHistory })
    : null;

  if (dryRunPerf) {
    checks.push({
      label: "Dry-run gate sample",
      status:
        dryRunPerf.readinessContribution.dryRunSampleSize >= 5 ? "PASS" : "WARNING",
      message: `${dryRunPerf.readinessContribution.dryRunSampleSize} dry-run(s) logged.`,
    });
    checks.push({
      label: "Dry-run would-submit rate",
      status: dryRunPerf.readinessContribution.readyForLiveGate
        ? "PASS"
        : dryRunPerf.readinessContribution.dryRunSampleSize >= 3
          ? "WARNING"
          : "FAIL",
      message: `${dryRunPerf.readinessContribution.wouldSubmitRatePct}% would pass live gate.`,
    });
    for (const b of dryRunPerf.readinessContribution.blockers) {
      actions.push(`Dry-run: ${b}`);
    }
  } else {
    actions.push("Run BTC options dry-runs on /options-dry-run before live gate.");
  }

  const risk = input?.optionsRiskReport ?? null;
  if (risk) {
    checks.push({
      label: "Portfolio Greeks estimable",
      status: risk.greeksEstimable ? "PASS" : "FAIL",
      message: risk.greeksEstimable
        ? `Net Δ ${risk.portfolio.netDelta} across ${risk.portfolio.positionCount} position(s).`
        : "Greeks cannot be estimated — options live blocked.",
    });
    checks.push({
      label: "Portfolio margin estimable",
      status: risk.marginEstimable ? "PASS" : "FAIL",
      message: risk.marginEstimable
        ? `Margin $${risk.margin.totalMarginUsd}${risk.margin.marginUsagePct != null ? ` (${risk.margin.marginUsagePct}% usage)` : ""}.`
        : "Margin cannot be estimated — options live blocked.",
    });
    if (risk.liveReadinessBlocked) {
      for (const b of risk.blockers) {
        actions.push(`Options risk: ${b}`);
      }
    }
    actions.push("Review portfolio Greeks on /options-risk.");
  } else {
    checks.push({
      label: "Portfolio Greeks estimable",
      status: "FAIL",
      message: "No options risk report — load /options-risk before live gate.",
    });
    checks.push({
      label: "Portfolio margin estimable",
      status: "FAIL",
      message: "Margin data missing — options live blocked.",
    });
    actions.push("Open /options-risk and refresh portfolio risk report.");
  }

  const failCount = checks.filter((c) => c.status === "FAIL").length;
  const warnCount = checks.filter((c) => c.status === "WARNING").length;

  const riskBlocksLive = risk?.liveReadinessBlocked ?? true;

  const overallStatus: OptionsLiveReadinessReport["overallStatus"] =
    config.liveEnabled || riskBlocksLive
      ? "FAIL"
      : failCount > 2
        ? "FAIL"
        : warnCount > 0
          ? "WARNING"
          : "PASS";

  return {
    generatedAt: new Date().toISOString(),
    overallStatus,
    checks,
    executionStatus: status,
    recommendedActions: actions,
    previewOnlyNotice:
      "Preview only — real BTC options live disabled. Compare paper trades on desk with options dry-run panel.",
    dryRunGate: dryRunPerf
      ? {
          sampleSize: dryRunPerf.readinessContribution.dryRunSampleSize,
          wouldSubmitRatePct: dryRunPerf.readinessContribution.wouldSubmitRatePct,
          readyForLiveGate: dryRunPerf.readinessContribution.readyForLiveGate,
          blockers: dryRunPerf.readinessContribution.blockers,
        }
      : null,
    optionsRiskGate: risk
      ? {
          overallStatus: risk.overallStatus,
          greeksEstimable: risk.greeksEstimable,
          marginEstimable: risk.marginEstimable,
          liveReadinessBlocked: risk.liveReadinessBlocked,
          netDelta: risk.portfolio.netDelta,
          marginUsagePct: risk.margin.marginUsagePct,
          blockers: risk.blockers,
        }
      : null,
  };
}
