import { isTestnetPrimaryAutomation } from "@/lib/automation-control-plane/primary-mode";
import type { AnomalyIncident } from "./types";

/** CRITICAL incidents that must not block Binance testnet execute/monitor in testnet_perp mode. */
export function isTestnetNonBlockingCriticalIncident(
  incident: AnomalyIncident,
): boolean {
  if (!isTestnetPrimaryAutomation()) return false;
  return incident.anomalyType === "alert_delivery_failed";
}

export function filterBlockingCriticalIncidents(
  incidents: AnomalyIncident[],
): AnomalyIncident[] {
  return incidents.filter((item) => !isTestnetNonBlockingCriticalIncident(item));
}
