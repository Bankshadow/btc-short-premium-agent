import { readCronJsonFile, writeCronJsonFile } from "@/lib/cron/cron-config";
import { upsertAnomalyFindings } from "@/lib/anomaly-detection/store";
import type { AnomalyFinding } from "@/lib/anomaly-detection/types";
import { recordMonitorEvent } from "@/lib/testnet-monitor/monitor-journal-server";
import type { ReadinessReport } from "./types";

const LAST_CHECK_FILE = "micro-live-readiness-last-check.json";
const AUDIT_FILE = "micro-live-readiness-audit.json";

export interface ReadinessAuditEntry {
  id: string;
  timestamp: string;
  readinessStatus: ReadinessReport["readinessStatus"];
  readinessScore: number;
  topBlocker: string | null;
  blockers: string[];
}

async function loadLastFingerprint(): Promise<string | null> {
  const parsed = await readCronJsonFile<{ fingerprint: string }>(
    LAST_CHECK_FILE,
    { fingerprint: "" },
  );
  return parsed?.fingerprint || null;
}

async function saveLastFingerprint(fingerprint: string): Promise<void> {
  await writeCronJsonFile(LAST_CHECK_FILE, {
    fingerprint,
    updatedAt: new Date().toISOString(),
  });
}

function fingerprint(report: ReadinessReport): string {
  return `${report.readinessStatus}:${report.readinessScore}:${report.blockers.join("|")}`.slice(
    0,
    240,
  );
}

async function appendReadinessAudit(entry: ReadinessAuditEntry): Promise<void> {
  const existing = await readCronJsonFile<ReadinessAuditEntry[]>(AUDIT_FILE, []);
  const list = Array.isArray(existing) ? existing : [];
  await writeCronJsonFile(AUDIT_FILE, [entry, ...list].slice(0, 200));
}

export async function applyMicroLiveReadinessSideEffects(input: {
  report: ReadinessReport;
}): Promise<{ journalWritten: boolean; governanceCreated: boolean; auditWritten: boolean }> {
  const fp = fingerprint(input.report);
  const last = await loadLastFingerprint();
  if (last === fp) {
    return { journalWritten: false, governanceCreated: false, auditWritten: false };
  }

  await recordMonitorEvent({
    exchange: "BINANCE",
    environment: "TESTNET",
    eventType: "READINESS_CHECKED",
    symbol: null,
    decisionLogId: input.report.evidenceLinks.find((l) => l.kind === "decision")?.id ?? null,
    orderId: null,
    positionId: null,
    payload: {
      readinessStatus: input.report.readinessStatus,
      readinessScore: input.report.readinessScore,
      blockers: input.report.blockers,
      warnings: input.report.warnings,
      nextRequiredActions: input.report.nextRequiredActions,
      liveTradingLocked: true,
    },
  });

  const auditEntry: ReadinessAuditEntry = {
    id: `mlr-audit-${Date.now()}`,
    timestamp: new Date().toISOString(),
    readinessStatus: input.report.readinessStatus,
    readinessScore: input.report.readinessScore,
    topBlocker: input.report.blockers[0] ?? null,
    blockers: input.report.blockers,
  };
  await appendReadinessAudit(auditEntry);

  let governanceCreated = false;
  if (input.report.readinessStatus === "BLOCKED") {
    const finding: AnomalyFinding = {
      anomalyType: "micro_live_readiness_blocked",
      severity: "WARNING",
      title: "Micro-live readiness BLOCKED",
      evidence: {
        blockers: input.report.blockers,
        score: input.report.readinessScore,
      },
      impactedModules: ["Micro-Live Readiness", "Governance", "Live Gate"],
      recommendedAction: input.report.nextRequiredActions[0] ?? "Resolve blockers before micro-live review.",
      fingerprint: `micro-live-readiness:${input.report.blockers[0] ?? "blocked"}`.slice(
        0,
        240,
      ),
    };
    await upsertAnomalyFindings([finding]);
    governanceCreated = true;
  }

  await saveLastFingerprint(fp);

  return { journalWritten: true, governanceCreated, auditWritten: true };
}

export async function loadReadinessAuditLog(): Promise<ReadinessAuditEntry[]> {
  const parsed = await readCronJsonFile<ReadinessAuditEntry[]>(AUDIT_FILE, []);
  return Array.isArray(parsed) ? parsed : [];
}
