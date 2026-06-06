import type { PermissionAuditEvent } from "./types";

/** Browser-safe permission audit append (no server fs). */
export function appendClientAuditEvent(
  event: Omit<PermissionAuditEvent, "id" | "timestamp"> & { timestamp?: string },
): PermissionAuditEvent {
  const record: PermissionAuditEvent = {
    id: `aos-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: event.timestamp ?? new Date().toISOString(),
    ...event,
  };
  if (typeof window !== "undefined") {
    try {
      const key = "btc-desk:agent-os-audit";
      const existing = JSON.parse(localStorage.getItem(key) ?? "[]") as PermissionAuditEvent[];
      localStorage.setItem(
        key,
        JSON.stringify([record, ...existing].slice(0, 100)),
      );
    } catch {
      // ignore
    }
  }
  return record;
}

export function loadClientAuditEvents(limit = 50): PermissionAuditEvent[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem("btc-desk:agent-os-audit");
    return raw ? (JSON.parse(raw) as PermissionAuditEvent[]).slice(0, limit) : [];
  } catch {
    return [];
  }
}
