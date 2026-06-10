import { loadAnomalyIncidents } from "./store";
import {
  filterTradeBlockingCriticalIncidents,
} from "./incident-policy";

export interface AnomalySafetyGateResult {
  allowed: boolean;
  reason: string | null;
  criticalIncidentIds: string[];
}

export async function evaluateRiskyActionGate(
  actionLabel: string,
): Promise<AnomalySafetyGateResult> {
  const incidents = await loadAnomalyIncidents();
  const blocking = filterTradeBlockingCriticalIncidents(incidents);
  if (blocking.length === 0) {
    return { allowed: true, reason: null, criticalIncidentIds: [] };
  }
  return {
    allowed: false,
    reason: `Blocked by ${blocking.length} open CRITICAL incident(s) before ${actionLabel}.`,
    criticalIncidentIds: blocking.map((item) => item.incidentId),
  };
}
