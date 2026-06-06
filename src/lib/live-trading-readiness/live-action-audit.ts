export const LIVE_ACTION_AUDIT_KEY = "btc-desk:live-action-audit";

export type LiveActionAuditKind =
  | "PREVIEW"
  | "EXECUTE"
  | "EXECUTE_BLOCKED"
  | "CLOSE"
  | "EMERGENCY_STOP"
  | "EMERGENCY_RELEASE";

export interface LiveActionAuditEntry {
  id: string;
  kind: LiveActionAuditKind;
  liveTradeId: string | null;
  symbol: string | null;
  decisionLogId: string | null;
  operatorNote: string | null;
  ok: boolean;
  detail: string;
  timestamp: string;
}

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

export function loadLiveActionAudit(): LiveActionAuditEntry[] {
  if (!isBrowser()) return [];
  try {
    const raw = localStorage.getItem(LIVE_ACTION_AUDIT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as LiveActionAuditEntry[]) : [];
  } catch {
    return [];
  }
}

export function appendLiveActionAudit(
  entry: Omit<LiveActionAuditEntry, "id" | "timestamp"> & {
    id?: string;
    timestamp?: string;
  },
): LiveActionAuditEntry[] {
  const full: LiveActionAuditEntry = {
    id: entry.id ?? `audit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: entry.timestamp ?? new Date().toISOString(),
    kind: entry.kind,
    liveTradeId: entry.liveTradeId,
    symbol: entry.symbol,
    decisionLogId: entry.decisionLogId,
    operatorNote: entry.operatorNote,
    ok: entry.ok,
    detail: entry.detail,
  };
  const next = [full, ...loadLiveActionAudit()].slice(0, 300);
  if (isBrowser()) {
    localStorage.setItem(LIVE_ACTION_AUDIT_KEY, JSON.stringify(next));
  }
  return next;
}

export function auditTrailHealthy(): boolean {
  return loadLiveActionAudit().length > 0;
}
