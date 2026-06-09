import { readCronJsonFile, writeCronJsonFile } from "@/lib/cron/cron-config";
import type {
  ObservabilityErrorRecord,
  ObservabilityIncident,
  ObservabilityIncidentLink,
  ObservabilityUsageRecord,
} from "./types";

const ERRORS_FILE = "observability-errors.json";
const INCIDENTS_FILE = "observability-incidents.json";
const USAGE_FILE = "observability-usage.json";
const METRICS_FILE = "observability-metrics.json";

const MAX_ERRORS = 200;
const MAX_INCIDENTS = 100;
const MAX_USAGE = 500;

export type ObservabilityMetrics = {
  analysisLatencyMs: number | null;
  lastAnalysisAt: string | null;
  alertDeliveryFailures: number;
  lastAlertDeliveryAt: string | null;
  errorCount1h: number;
  policyBlocks1h: number;
  lastCollectedAt: string | null;
};

export async function loadObservabilityMetrics(): Promise<ObservabilityMetrics> {
  return readCronJsonFile(METRICS_FILE, {
    analysisLatencyMs: null,
    lastAnalysisAt: null,
    alertDeliveryFailures: 0,
    lastAlertDeliveryAt: null,
    errorCount1h: 0,
    policyBlocks1h: 0,
    lastCollectedAt: null,
  });
}

export async function saveObservabilityMetrics(
  patch: Partial<ObservabilityMetrics>,
): Promise<ObservabilityMetrics> {
  const current = await loadObservabilityMetrics();
  const next = { ...current, ...patch };
  await writeCronJsonFile(METRICS_FILE, next);
  return next;
}

export async function appendObservabilityError(
  record: Omit<ObservabilityErrorRecord, "errorId" | "occurredAt"> & {
    occurredAt?: string;
  },
): Promise<ObservabilityErrorRecord> {
  const errors = await loadObservabilityErrors();
  const entry: ObservabilityErrorRecord = {
    errorId: `err-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    occurredAt: record.occurredAt ?? new Date().toISOString(),
    ...record,
  };
  await writeCronJsonFile(ERRORS_FILE, [entry, ...errors].slice(0, MAX_ERRORS));
  const metrics = await loadObservabilityMetrics();
  await saveObservabilityMetrics({
    errorCount1h: metrics.errorCount1h + 1,
  });
  return entry;
}

export async function loadObservabilityErrors(): Promise<ObservabilityErrorRecord[]> {
  return readCronJsonFile(ERRORS_FILE, []);
}

export async function appendObservabilityUsage(
  record: Omit<ObservabilityUsageRecord, "usageId" | "occurredAt">,
): Promise<ObservabilityUsageRecord> {
  const usage = await loadObservabilityUsage();
  const entry: ObservabilityUsageRecord = {
    usageId: `use-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    occurredAt: new Date().toISOString(),
    ...record,
  };
  await writeCronJsonFile(USAGE_FILE, [entry, ...usage].slice(0, MAX_USAGE));
  return entry;
}

export async function loadObservabilityUsage(): Promise<ObservabilityUsageRecord[]> {
  return readCronJsonFile(USAGE_FILE, []);
}

export async function loadObservabilityIncidents(): Promise<ObservabilityIncident[]> {
  return readCronJsonFile(INCIDENTS_FILE, []);
}

export async function createObservabilityIncident(input: {
  workspaceId: string;
  type: ObservabilityIncident["type"];
  severity: ObservabilityIncident["severity"];
  description: string;
  rootCause?: string;
  correctiveAction?: string;
  autoCreated?: boolean;
  links?: ObservabilityIncidentLink;
}): Promise<ObservabilityIncident> {
  const incidents = await loadObservabilityIncidents();
  const now = new Date().toISOString();
  const incident: ObservabilityIncident = {
    id: `obs-inc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    workspaceId: input.workspaceId,
    createdAt: now,
    updatedAt: now,
    type: input.type,
    severity: input.severity,
    status: "open",
    description: input.description.trim(),
    rootCause: input.rootCause?.trim() ?? "",
    correctiveAction: input.correctiveAction?.trim() ?? "",
    resolutionNote: "",
    autoCreated: input.autoCreated ?? false,
    links: input.links ?? {},
  };
  await writeCronJsonFile(
    INCIDENTS_FILE,
    [incident, ...incidents].slice(0, MAX_INCIDENTS),
  );
  return incident;
}

export async function updateObservabilityIncident(
  id: string,
  patch: Partial<
    Pick<
      ObservabilityIncident,
      "status" | "severity" | "description" | "rootCause" | "correctiveAction" | "resolutionNote"
    >
  >,
): Promise<ObservabilityIncident | null> {
  const incidents = await loadObservabilityIncidents();
  const prev = incidents.find((i) => i.id === id);
  if (!prev) return null;
  const updated: ObservabilityIncident = {
    ...prev,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  await writeCronJsonFile(
    INCIDENTS_FILE,
    incidents.map((i) => (i.id === id ? updated : i)),
  );
  return updated;
}
