import fs from "fs/promises";
import path from "path";
import { getCronDataDir } from "@/lib/cron/cron-config";
import type {
  AnomalyFinding,
  AnomalyIncident,
  AnomalyIncidentStatus,
  IncidentActor,
} from "./types";

const INCIDENTS_FILE = "anomaly-incidents-v2.json";
const MAX_INCIDENTS = 500;

function incidentsPath(): string {
  return path.join(getCronDataDir(), INCIDENTS_FILE);
}

function newIncidentId(): string {
  return `anm-inc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function severityRank(value: AnomalyIncident["severity"]): number {
  if (value === "CRITICAL") return 3;
  if (value === "WARNING") return 2;
  return 1;
}

async function saveIncidents(incidents: AnomalyIncident[]): Promise<void> {
  const filePath = incidentsPath();
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(
    filePath,
    JSON.stringify(incidents.slice(0, MAX_INCIDENTS), null, 2),
    "utf8",
  );
}

export async function loadAnomalyIncidents(): Promise<AnomalyIncident[]> {
  try {
    const raw = await fs.readFile(incidentsPath(), "utf8");
    const parsed = JSON.parse(raw) as AnomalyIncident[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
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

  for (const finding of findings) {
    const existing = byFingerprint.get(finding.fingerprint);
    if (existing && existing.status !== "RESOLVED") {
      byFingerprint.set(finding.fingerprint, {
        ...existing,
        severity:
          severityRank(finding.severity) > severityRank(existing.severity)
            ? finding.severity
            : existing.severity,
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
