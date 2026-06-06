import type { CommandCenterBlocker } from "@/lib/command-center/types";
import type { PolicyObservabilityState } from "@/lib/policy-engine/types";
import type { PlatformHealthReport } from "./types";

export function observabilityToPolicyState(
  report: PlatformHealthReport | null,
): PolicyObservabilityState | null {
  if (!report) return null;
  return {
    databaseHealthy: !report.signals.database.liveExecutionBlocked,
    alertDeliveryHealthy:
      report.signals.alerts.anyChannelConfigured &&
      report.signals.alerts.recentDeliveryFailures === 0,
    criticalTradingRisk:
      report.dimensions.find((d) => d.dimension === "risk")?.level === "CRITICAL",
    liveTradingPosture: report.liveTradingPosture,
  };
}

export function observabilityCommandCenterBlockers(
  report: PlatformHealthReport | null,
): CommandCenterBlocker[] {
  if (!report) return [];
  const blockers: CommandCenterBlocker[] = [];

  if (report.commandCenterShouldBlock) {
    blockers.push({
      id: "observability_critical",
      label: "Observability critical",
      detail:
        report.safetyNotices[0] ??
        report.signals.liveBlockers[0] ??
        "Platform health CRITICAL — review /admin/health.",
      hard: true,
    });
  }

  if (report.signals.database.liveExecutionBlocked) {
    blockers.push({
      id: "warehouse_write_blocked",
      label: "Database write blocked",
      detail:
        report.signals.database.liveBlockReason ??
        "Warehouse write health blocks live execution.",
      hard: true,
    });
  }

  if (
    report.liveTradingPosture === "CAUTION" &&
    (!report.signals.alerts.anyChannelConfigured ||
      report.signals.alerts.recentDeliveryFailures > 0)
  ) {
    blockers.push({
      id: "alert_delivery_degraded",
      label: "Alert delivery degraded",
      detail: report.signals.alerts.anyChannelConfigured
        ? `${report.signals.alerts.recentDeliveryFailures} recent delivery failure(s).`
        : "No alert channels configured — live requires CAUTION.",
      hard: false,
    });
  }

  return blockers;
}
