import { getActiveWorkspaceId } from "@/lib/platform/workspace-registry";
import { readScopedJson, writeScopedJson } from "@/lib/platform/scoped-storage";
import type { DeskUserRole, GovernanceAuditEntry } from "./governance-types";

export const GOVERNANCE_AUDIT_STORAGE_KEY =
  "trading-agents-crypto-desk:governance-audit-log";

export function loadGovernanceAuditLog(): GovernanceAuditEntry[] {
  if (typeof window === "undefined") return [];
  try {
    return readScopedJson<GovernanceAuditEntry[]>("governance-audit", []);
  } catch {
    return [];
  }
}

export function appendGovernanceAudit(input: {
  action: string;
  detail: string;
  actorName: string;
  actorRole: DeskUserRole;
}): GovernanceAuditEntry[] {
  const entry: GovernanceAuditEntry = {
    id: `gov-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    workspaceId: getActiveWorkspaceId(),
    timestamp: new Date().toISOString(),
    ...input,
  };
  const next = [entry, ...loadGovernanceAuditLog()].slice(0, 200);
  writeScopedJson("governance-audit", next);
  return next;
}
