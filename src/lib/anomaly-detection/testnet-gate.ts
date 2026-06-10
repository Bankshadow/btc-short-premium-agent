import { isTestnetPrimaryAutomation } from "@/lib/automation-control-plane/primary-mode";
import type { AnomalyIncident, AnomalyIncidentStatus } from "./types";

function isOpenStatus(status: AnomalyIncidentStatus): boolean {
  return status === "OPEN" || status === "INVESTIGATING";
}

/** CRITICAL incidents that must not block Binance testnet execute/monitor in testnet_perp mode. */
export function isTestnetNonBlockingCriticalIncident(
  incident: AnomalyIncident,
): boolean {
  if (!isTestnetPrimaryAutomation()) return false;
  return incident.anomalyType === "alert_delivery_failed";
}

/** CRITICAL incidents that should not pause mission controller on testnet-only ops. */
export function isMissionPausingCriticalIncident(incident: AnomalyIncident): boolean {
  if (incident.severity !== "CRITICAL" || !isOpenStatus(incident.status)) {
    return false;
  }
  if (isTestnetNonBlockingCriticalIncident(incident)) return false;
  if (
    isTestnetPrimaryAutomation() &&
    incident.anomalyType === "micro_live_readiness_blocked"
  ) {
    return false;
  }
  return true;
}

export function filterBlockingCriticalIncidents(
  incidents: AnomalyIncident[],
): AnomalyIncident[] {
  return incidents.filter((item) => !isTestnetNonBlockingCriticalIncident(item));
}
