import { loadAnomalyIncidents, isIncidentOpen } from "./store";
import { filterBlockingCriticalIncidents } from "./testnet-gate";

export interface AnomalySafetyGateResult {
  allowed: boolean;
  reason: string | null;
  criticalIncidentIds: string[];
}

export async function evaluateRiskyActionGate(
  actionLabel: string,
): Promise<AnomalySafetyGateResult> {
  const incidents = await loadAnomalyIncidents();
  const criticalOpen = incidents.filter(
    (item) => item.severity === "CRITICAL" && isIncidentOpen(item.status),
  );
  const blocking = filterBlockingCriticalIncidents(criticalOpen);
  if (blocking.length === 0) {
    return { allowed: true, reason: null, criticalIncidentIds: [] };
  }
  return {
    allowed: false,
    reason: `Blocked by ${blocking.length} open CRITICAL incident(s) before ${actionLabel}.`,
    criticalIncidentIds: blocking.map((item) => item.incidentId),
  };
}
