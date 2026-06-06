import { POLICY_AUDIT_FILE, POLICY_MAX_AUDIT } from "./config";
import type { PolicyDecisionRecord, PolicyResult } from "./types";
import path from "path";

const memoryAudit: PolicyDecisionRecord[] = [];

function isServer(): boolean {
  return typeof window === "undefined";
}

function auditPath(): string {
  const base = process.env.JOURNAL_DATA_DIR;
  const dir = base ?? path.join(/* turbopackIgnore: true */ process.cwd(), "data");
  return path.join(dir, POLICY_AUDIT_FILE);
}

async function readServerAudit(): Promise<PolicyDecisionRecord[]> {
  if (!isServer()) return [];
  try {
    const fs = await import("fs/promises");
    const raw = await fs.readFile(auditPath(), "utf8");
    const parsed = JSON.parse(raw) as PolicyDecisionRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeServerAudit(records: PolicyDecisionRecord[]): Promise<void> {
  if (!isServer()) return;
  try {
    const fs = await import("fs/promises");
    const filePath = auditPath();
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(records, null, 2), "utf8");
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
