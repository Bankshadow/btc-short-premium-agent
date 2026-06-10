import { isTestnetPrimaryAutomation } from "@/lib/automation-control-plane/primary-mode";
import { readCronJsonFile, writeCronJsonFile } from "@/lib/cron/cron-config";
import type {
  AnomalyFinding,
  AnomalyIncident,
  AnomalyIncidentStatus,
  IncidentActor,
} from "./types";

const INCIDENTS_FILE = "anomaly-incidents-v2.json";
const MAX_INCIDENTS = 500;

function newIncidentId(): string {
  return `anm-inc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function severityRank(value: AnomalyIncident["severity"]): number {
  if (value === "CRITICAL") return 3;
  if (value === "WARNING") return 2;
  return 1;
}

function resolveIncidentSeverity(
  existing: AnomalyIncident | undefined,
  finding: AnomalyFinding,
): AnomalyIncident["severity"] {
  if (!existing) return finding.severity;
  if (
    isTestnetPrimaryAutomation() &&
    finding.anomalyType === "alert_delivery_failed" &&
    finding.severity === "WARNING"
  ) {
    return "WARNING";
  }
  return severityRank(finding.severity) > severityRank(existing.severity)
    ? finding.severity
    : existing.severity;
}

async function saveIncidents(incidents: AnomalyIncident[]): Promise<void> {
  await writeCronJsonFile(
    INCIDENTS_FILE,
    incidents.slice(0, MAX_INCIDENTS),
  );
}

export async function loadAnomalyIncidents(): Promise<AnomalyIncident[]> {
  const parsed = await readCronJsonFile<AnomalyIncident[]>(INCIDENTS_FILE, []);
  return Array.isArray(parsed) ? parsed : [];
}

function healStaleTestnetIncidents(
  incidents: AnomalyIncident[],
): AnomalyIncident[] {
  if (!isTestnetPrimaryAutomation()) return incidents;
  const now = new Date().toISOString();
  return incidents.map((incident) => {
    if (
      incident.anomalyType === "alert_delivery_failed" &&
      incident.severity === "CRITICAL"
    ) {
      return { ...incident, severity: "WARNING", updatedAt: now };
    }
    if (
      incident.anomalyType === "micro_live_readiness_blocked" &&
      incident.severity === "CRITICAL"
    ) {
      return { ...incident, severity: "WARNING", updatedAt: now };
    }
    return incident;
  });
}

export async function upsertAnomalyFindings(
  findings: AnomalyFinding[],
): Promise<AnomalyIncident[]> {
  const current = healStaleTestnetIncidents(await loadAnomalyIncidents());
  const now = new Date().toISOString();
  const byFingerprint = new Map<string, AnomalyIncident>();
  for (const incident of current) {
    byFingerprint.set(incident.fingerprint, incident);
  }

  for (const finding of findings) {
    const existing = byFingerprint.get(finding.fingerprint);
    if (existing && existing.status !== "RESOLVED") {
      byFingerprint.set(finding.fingerprint, {
        ...existing,
        severity: resolveIncidentSeverity(existing, finding),
        title: finding.title,
        evidence: finding.evidence,
        impactedModules: finding.impactedModules,
        recommendedAction: finding.recommendedAction,
        updatedAt: now,
      });
      continue;
    }

    const incident: AnomalyIncident = {
      incidentId: newIncidentId(),
      anomalyType: finding.anomalyType,
      severity: finding.severity,
      title: finding.title,
      evidence: finding.evidence,
      impactedModules: finding.impactedModules,
      recommendedAction: finding.recommendedAction,
      status: "OPEN",
      fingerprint: finding.fingerprint,
      autoCreated: true,
      createdAt: now,
      updatedAt: now,
      resolvedAt: null,
      resolvedBy: null,
      resolutionNote: null,
    };
    byFingerprint.set(finding.fingerprint, incident);
  }

  const next = [...byFingerprint.values()].sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt),
  );
  await saveIncidents(next);
  return next;
}

export async function updateAnomalyIncident(
  incidentId: string,
  patch: {
    status?: AnomalyIncidentStatus;
    resolutionNote?: string | null;
    actor?: IncidentActor;
  },
): Promise<AnomalyIncident | null> {
  const incidents = await loadAnomalyIncidents();
  const target = incidents.find((i) => i.incidentId === incidentId);
  if (!target) return null;

  if (
    target.severity === "CRITICAL" &&
    patch.status === "RESOLVED" &&
    patch.actor === "AI"
  ) {
    throw new Error("AI cannot auto-resolve CRITICAL incidents.");
  }

  const now = new Date().toISOString();
  const updated: AnomalyIncident = {
    ...target,
    status: patch.status ?? target.status,
    resolutionNote: patch.resolutionNote ?? target.resolutionNote,
    resolvedBy:
      patch.status === "RESOLVED" ? patch.actor ?? target.resolvedBy : target.resolvedBy,
    resolvedAt:
      patch.status === "RESOLVED" ? now : patch.status ? null : target.resolvedAt,
    updatedAt: now,
  };

  const next = incidents.map((item) =>
    item.incidentId === incidentId ? updated : item,
  );
  await saveIncidents(next);
  return updated;
}

export function isIncidentOpen(status: AnomalyIncidentStatus): boolean {
  return status === "OPEN" || status === "INVESTIGATING";
}

export async function hasOpenCriticalAnomalyIncident(): Promise<boolean> {
  const incidents = await loadAnomalyIncidents();
  return incidents.some((i) => i.severity === "CRITICAL" && isIncidentOpen(i.status));
}
