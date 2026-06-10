import {
  buildAutoResolvePatch,
  normalizeAnomalyIncidents,
  shouldAutoResolveDetectIncident,
  shouldAutoResolveOperationalIncident,
  type OperationalIncidentReconcileInput,
} from "./incident-policy";
import { loadAnomalyIncidents, saveAnomalyIncidents } from "./store";
import type { AnomalyFinding, AnomalyIncident } from "./types";

export interface ReconcileIncidentsResult {
  resolvedCount: number;
  incidents: AnomalyIncident[];
}

/** Single reconcile entry — operational runtime + optional detect fingerprint sweep. */
export async function reconcileIncidents(input: {
  operational?: OperationalIncidentReconcileInput;
  detectFindings?: AnomalyFinding[];
}): Promise<ReconcileIncidentsResult> {
  const incidents = normalizeAnomalyIncidents(await loadAnomalyIncidents());
  const activeFingerprints = new Set(
    (input.detectFindings ?? []).map((f) => f.fingerprint),
  );

  let resolvedCount = 0;
  const next = incidents.map((incident) => {
    if (input.operational && shouldAutoResolveOperationalIncident(incident, input.operational)) {
      resolvedCount += 1;
      return buildAutoResolvePatch(
        incident,
        "Auto-resolved — operational condition cleared.",
      );
    }
    if (
      input.detectFindings &&
      shouldAutoResolveDetectIncident(incident, activeFingerprints)
    ) {
      resolvedCount += 1;
      return buildAutoResolvePatch(
        incident,
        "Auto-resolved — detect cycle no longer reports this finding.",
      );
    }
    return incident;
  });

  if (resolvedCount > 0) {
    await saveAnomalyIncidents(next);
  }

  return { resolvedCount, incidents: resolvedCount > 0 ? next : incidents };
}
