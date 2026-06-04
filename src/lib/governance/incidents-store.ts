import type {
  DeskIncident,
  IncidentSeverity,
  IncidentStatus,
  IncidentType,
} from "./governance-types";
import { appendGovernanceAudit } from "./governance-audit-log";
import { loadGovernanceState } from "./governance-state";

export const INCIDENTS_STORAGE_KEY =
  "trading-agents-crypto-desk:desk-incidents";

export function loadIncidents(): DeskIncident[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(INCIDENTS_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as DeskIncident[];
  } catch {
    return [];
  }
}

function persist(incidents: DeskIncident[]): DeskIncident[] {
  if (typeof window !== "undefined") {
    localStorage.setItem(INCIDENTS_STORAGE_KEY, JSON.stringify(incidents));
  }
  return incidents;
}

export function createIncident(input: {
  type: IncidentType;
  severity: IncidentSeverity;
  description: string;
  affectedDecisionId?: string | null;
  rootCause?: string;
  correctiveAction?: string;
}): DeskIncident {
  const gov = loadGovernanceState();
  const now = new Date().toISOString();
  const incident: DeskIncident = {
    id: `inc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    createdAt: now,
    updatedAt: now,
    type: input.type,
    severity: input.severity,
    description: input.description.trim(),
    affectedDecisionId: input.affectedDecisionId ?? null,
    rootCause: input.rootCause?.trim() ?? "",
    correctiveAction: input.correctiveAction?.trim() ?? "",
    status: "open",
  };
  persist([incident, ...loadIncidents()]);
  appendGovernanceAudit({
    action: "incident_created",
    detail: `${incident.severity} ${incident.type}: ${incident.description.slice(0, 80)}`,
    actorName: gov.operatorName,
    actorRole: gov.operatorRole,
  });
  return incident;
}

export function updateIncident(
  id: string,
  patch: Partial<
    Pick<
      DeskIncident,
      | "severity"
      | "description"
      | "affectedDecisionId"
      | "rootCause"
      | "correctiveAction"
      | "status"
      | "type"
    >
  >,
): DeskIncident | null {
  const gov = loadGovernanceState();
  const prev = loadIncidents().find((inc) => inc.id === id);
  if (!prev) return null;
  const updated: DeskIncident = {
    ...prev,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  const next = loadIncidents().map((inc) => (inc.id === id ? updated : inc));
  persist(next);
  appendGovernanceAudit({
    action: "incident_updated",
    detail: `${id} → ${updated.status}`,
    actorName: gov.operatorName,
    actorRole: gov.operatorRole,
  });
  return updated;
}

export function deleteIncident(id: string): void {
  const gov = loadGovernanceState();
  persist(loadIncidents().filter((i) => i.id !== id));
  appendGovernanceAudit({
    action: "incident_deleted",
    detail: id,
    actorName: gov.operatorName,
    actorRole: gov.operatorRole,
  });
}
