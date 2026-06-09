import { readCronJsonFile, writeCronJsonFile } from "@/lib/cron/cron-config";
import type { AgentOsAction, AgentOsMode, PermissionApprovalScope, PermissionAuditEvent } from "./types";

const AUDIT_FILE = "agent-os-permission-audit.json";
const MAX_AUDIT = 500;

const memoryAudit: PermissionAuditEvent[] = [];

function isServer(): boolean {
  return typeof window === "undefined";
}

async function readServerAudit(): Promise<PermissionAuditEvent[]> {
  if (!isServer()) return [];
  const parsed = await readCronJsonFile<PermissionAuditEvent[]>(AUDIT_FILE, []);
  return Array.isArray(parsed) ? parsed : [];
}

async function writeServerAudit(records: PermissionAuditEvent[]): Promise<void> {
  if (!isServer()) return;
  try {
    await writeCronJsonFile(AUDIT_FILE, records);
  } catch {
    // memory fallback
  }
}

export async function appendPermissionAuditEvent(input: {
  action: AgentOsAction;
  approved: boolean;
  actor: string;
  reason: string;
  linkedTradeId?: string | null;
  linkedDecisionId?: string | null;
  approvalScope?: PermissionApprovalScope | null;
  mode: AgentOsMode;
}): Promise<PermissionAuditEvent> {
  const record: PermissionAuditEvent = {
    id: `aos-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
    action: input.action,
    approved: input.approved,
    actor: input.actor,
    reason: input.reason,
    linkedTradeId: input.linkedTradeId ?? null,
    linkedDecisionId: input.linkedDecisionId ?? null,
    approvalScope: input.approvalScope ?? null,
    mode: input.mode,
  };

  memoryAudit.unshift(record);
  if (memoryAudit.length > MAX_AUDIT) memoryAudit.pop();

  if (isServer()) {
    const existing = await readServerAudit();
    const next = [record, ...existing].slice(0, MAX_AUDIT);
    await writeServerAudit(next);
  }

  return record;
}

export async function loadPermissionAudit(limit = 50): Promise<PermissionAuditEvent[]> {
  if (isServer()) {
    const server = await readServerAudit();
    return server.slice(0, limit);
  }
  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem("btc-desk:agent-os-audit");
      return raw ? (JSON.parse(raw) as PermissionAuditEvent[]).slice(0, limit) : [];
    } catch {
      return memoryAudit.slice(0, limit);
    }
  }
  return memoryAudit.slice(0, limit);
}
