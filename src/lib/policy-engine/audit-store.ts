import { POLICY_AUDIT_FILE, POLICY_MAX_AUDIT } from "./config";
import type { PolicyDecisionRecord, PolicyResult } from "./types";

const memoryAudit: PolicyDecisionRecord[] = [];

function isServer(): boolean {
  return typeof window === "undefined";
}

async function readServerAudit(): Promise<PolicyDecisionRecord[]> {
  if (!isServer()) return [];
  try {
    const { readCronJsonFile } = await import("@/lib/cron/cron-config");
    const parsed = await readCronJsonFile<PolicyDecisionRecord[]>(
      POLICY_AUDIT_FILE,
      [],
    );
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeServerAudit(records: PolicyDecisionRecord[]): Promise<void> {
  if (!isServer()) return;
  try {
    const { writeCronJsonFile } = await import("@/lib/cron/cron-config");
    await writeCronJsonFile(POLICY_AUDIT_FILE, records);
  } catch {
    // fall back to memory only
  }
}

export async function appendPolicyDecision(
  result: PolicyResult,
  userRole: string,
): Promise<PolicyDecisionRecord> {
  const record: PolicyDecisionRecord = {
    recordId: `pol-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    workspaceId: result.workspaceId,
    action: result.action,
    decision: result.decision,
    blockers: result.blockers,
    reasons: result.reasons.slice(0, 5),
    userRole: userRole as PolicyDecisionRecord["userRole"],
    evaluatedAt: result.evaluatedAt,
  };

  memoryAudit.unshift(record);
  if (memoryAudit.length > POLICY_MAX_AUDIT) memoryAudit.pop();

  if (isServer()) {
    const existing = await readServerAudit();
    await writeServerAudit([record, ...existing].slice(0, POLICY_MAX_AUDIT));
  }

  return record;
}

export async function loadPolicyDecisions(): Promise<PolicyDecisionRecord[]> {
  if (!isServer()) return [...memoryAudit];
  const server = await readServerAudit();
  if (server.length > 0) return server;
  return [...memoryAudit];
}

export function loadClientPolicyDecisions(): PolicyDecisionRecord[] {
  return [...memoryAudit];
}
