import type { OptionsRiskCheck } from "@/lib/options-execution/types";
import type { RealTimeRiskReport } from "./types";

export function applyRealTimeRiskToOptionsChecks(
  report: RealTimeRiskReport,
): OptionsRiskCheck[] {
  const checks: OptionsRiskCheck[] = [];

  checks.push({
    id: "realtime_risk_status",
    label: "Real-time risk",
    status:
      report.riskStatus === "SAFE"
        ? "PASS"
        : report.riskStatus === "CAUTION"
          ? "WARNING"
          : "FAIL",
    message: `${report.riskStatus} — ${report.checks.filter((c) => c.blocking).length} blocking check(s).`,
    blocking: report.blockNewTrades,
  });

  if (report.reduceOnlyMode) {
    checks.push({
      id: "realtime_reduce_only",
      label: "Reduce-only mode",
      status: "WARNING",
      message: "Real-time risk recommends reduce-only — new options exposure limited.",
      blocking: false,
    });
  }

  return checks;
}
