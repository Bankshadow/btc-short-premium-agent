import { loadAnomalyIncidents, isIncidentOpen } from "./store";

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
  if (criticalOpen.length === 0) {
    return { allowed: true, reason: null, criticalIncidentIds: [] };
  }
  return {
    allowed: false,
    reason: `Blocked by ${criticalOpen.length} open CRITICAL incident(s) before ${actionLabel}.`,
    criticalIncidentIds: criticalOpen.map((item) => item.incidentId),
  };
}
