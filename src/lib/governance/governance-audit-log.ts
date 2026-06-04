import type { DeskUserRole, GovernanceAuditEntry } from "./governance-types";

export const GOVERNANCE_AUDIT_STORAGE_KEY =
  "trading-agents-crypto-desk:governance-audit-log";

export function loadGovernanceAuditLog(): GovernanceAuditEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(GOVERNANCE_AUDIT_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as GovernanceAuditEntry[];
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
    timestamp: new Date().toISOString(),
    ...input,
  };
  const next = [entry, ...loadGovernanceAuditLog()].slice(0, 200);
  if (typeof window !== "undefined") {
    localStorage.setItem(GOVERNANCE_AUDIT_STORAGE_KEY, JSON.stringify(next));
  }
  return next;
}
