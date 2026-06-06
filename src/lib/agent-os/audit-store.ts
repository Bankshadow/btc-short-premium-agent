import { getCronDataDir } from "@/lib/cron/cron-config";
import type { AgentOsAction, AgentOsMode, PermissionApprovalScope, PermissionAuditEvent } from "./types";
import path from "path";

const AUDIT_FILE = "agent-os-permission-audit.json";
const MAX_AUDIT = 500;

const memoryAudit: PermissionAuditEvent[] = [];

function isServer(): boolean {
  return typeof window === "undefined";
}

function auditPath(): string {
  return path.join(getCronDataDir(), AUDIT_FILE);
}

async function readServerAudit(): Promise<PermissionAuditEvent[]> {
  if (!isServer()) return [];
  try {
    const fs = await import("fs/promises");
    const raw = await fs.readFile(auditPath(), "utf8");
    const parsed = JSON.parse(raw) as PermissionAuditEvent[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeServerAudit(records: PermissionAuditEvent[]): Promise<void> {
  if (!isServer()) return;
  try {
    const fs = await import("fs/promises");
    const filePath = auditPath();
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(records, null, 2), "utf8");
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
