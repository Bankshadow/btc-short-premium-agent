import {
  normalizeAnomalyFinding,
  normalizeAnomalyIncident,
  normalizeAnomalyIncidents,
  isTradeBlockingCriticalIncident,
  hasTradeBlockingCriticalIncident,
} from "./incident-policy";
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
  const normalized = normalizeAnomalyFinding(finding);
  if (!existing) return normalized.severity;
  return severityRank(normalized.severity) > severityRank(existing.severity)
    ? normalized.severity
    : existing.severity;
}

export async function saveAnomalyIncidents(
  incidents: AnomalyIncident[],
): Promise<void> {
  await writeCronJsonFile(
    INCIDENTS_FILE,
    normalizeAnomalyIncidents(incidents).slice(0, MAX_INCIDENTS),
  );
}

export async function loadAnomalyIncidents(): Promise<AnomalyIncident[]> {
  const parsed = await readCronJsonFile<AnomalyIncident[]>(INCIDENTS_FILE, []);
  return normalizeAnomalyIncidents(Array.isArray(parsed) ? parsed : []);
}

export async function upsertAnomalyFindings(
  findings: AnomalyFinding[],
): Promise<AnomalyIncident[]> {
  const current = await loadAnomalyIncidents();
  const now = new Date().toISOString();
  const byFingerprint = new Map<string, AnomalyIncident>();
  for (const incident of current) {
    byFingerprint.set(incident.fingerprint, incident);
  }

  for (const raw of findings) {
    const finding = normalizeAnomalyFinding(raw);
    const existing = byFingerprint.get(finding.fingerprint);
    if (existing && existing.status !== "RESOLVED") {
      byFingerprint.set(finding.fingerprint, normalizeAnomalyIncident({
        ...existing,
        severity: resolveIncidentSeverity(existing, finding),
        title: finding.title,
        evidence: finding.evidence,
        impactedModules: finding.impactedModules,
        recommendedAction: finding.recommendedAction,
        updatedAt: now,
      }));
      continue;
    }

    const incident: AnomalyIncident = normalizeAnomalyIncident({
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
    });
    byFingerprint.set(finding.fingerprint, incident);
  }

  const next = [...byFingerprint.values()].sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt),
  );
  await saveAnomalyIncidents(next);
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

  const normalized = normalizeAnomalyIncident(target);
  if (
    isTradeBlockingCriticalIncident(normalized) &&
    patch.status === "RESOLVED" &&
    patch.actor === "AI"
  ) {
    throw new Error("AI cannot auto-resolve CRITICAL incidents.");
  }

  const now = new Date().toISOString();
  const updated: AnomalyIncident = normalizeAnomalyIncident({
    ...normalized,
    status: patch.status ?? normalized.status,
    resolutionNote: patch.resolutionNote ?? normalized.resolutionNote,
    resolvedBy:
      patch.status === "RESOLVED"
        ? patch.actor ?? normalized.resolvedBy
        : normalized.resolvedBy,
    resolvedAt:
      patch.status === "RESOLVED"
        ? now
        : patch.status
          ? null
          : normalized.resolvedAt,
    updatedAt: now,
  });

  const next = incidents.map((item) =>
    item.incidentId === incidentId ? updated : item,
  );
  await saveAnomalyIncidents(next);
  return updated;
}

export async function hasOpenCriticalAnomalyIncident(): Promise<boolean> {
  const incidents = await loadAnomalyIncidents();
  return hasTradeBlockingCriticalIncident(incidents);
}
