import { PLATFORM_REGISTRY_KEY } from "./constants";

export type ScopedDomain =
  | "decision-log"
  | "governance"
  | "desk-settings"
  | "paper-orders"
  | "paper-settings"
  | "governance-audit"
  | "operator-overrides"
  | "incidents"
  | "autopilot-settings"
  | "paper-autopilot"
  | "kill-switch"
  | "unified-ledger";

const LEGACY_KEYS: Partial<Record<ScopedDomain, string>> = {
  "decision-log": "trading-agents-crypto-desk:decision-log",
  governance: "trading-agents-crypto-desk:governance-desk-state",
  "desk-settings": "trading-agents-crypto-desk:desk-settings",
  "paper-orders": "trading-agents-crypto-desk:paper-orders",
  "paper-settings": "trading-agents-crypto-desk:paper-settings",
  "governance-audit": "trading-agents-crypto-desk:governance-audit-log",
  "operator-overrides": "trading-agents-crypto-desk:operator-override-log",
  incidents: "trading-agents-crypto-desk:desk-incidents",
  "autopilot-settings": "btc-desk:autopilot-settings",
  "paper-autopilot": "btc-desk:paper-autopilot-settings",
  "kill-switch": "trading-agents-crypto-desk:kill-switch-state",
  "unified-ledger": "btc-desk:unified-ledger",
};

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function readActiveWorkspaceId(): string {
  if (!isBrowser()) return "server-default";
  try {
    const raw = localStorage.getItem(PLATFORM_REGISTRY_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { activeWorkspaceId?: string };
      if (parsed.activeWorkspaceId) return parsed.activeWorkspaceId;
    }
  } catch {
    /* ignore */
  }
  return "default-ws";
}

export function scopedStorageKey(
  domain: ScopedDomain,
  workspaceId?: string,
): string {
  const ws = workspaceId ?? readActiveWorkspaceId();
  return `btc-platform:ws:${ws}:${domain}`;
}

export function readScopedJson<T>(
  domain: ScopedDomain,
  fallback: T,
  workspaceId?: string,
): T {
  if (!isBrowser()) return fallback;
  const key = scopedStorageKey(domain, workspaceId);
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw) as T;
    const legacy = LEGACY_KEYS[domain];
    if (legacy) {
      const legacyRaw = localStorage.getItem(legacy);
      if (legacyRaw) {
        const parsed = JSON.parse(legacyRaw) as T;
        localStorage.setItem(key, legacyRaw);
        return parsed;
      }
    }
    return fallback;
  } catch {
    return fallback;
  }
}

export function writeScopedJson<T>(
  domain: ScopedDomain,
  value: T,
  workspaceId?: string,
): T {
  if (isBrowser()) {
    localStorage.setItem(scopedStorageKey(domain, workspaceId), JSON.stringify(value));
  }
  return value;
}

export function migrateLegacyDomainToWorkspace(
  domain: ScopedDomain,
  workspaceId: string,
): boolean {
  if (!isBrowser()) return false;
  const key = scopedStorageKey(domain, workspaceId);
  if (localStorage.getItem(key)) return false;
  const legacy = LEGACY_KEYS[domain];
  if (!legacy) return false;
  const legacyRaw = localStorage.getItem(legacy);
  if (!legacyRaw) return false;
  localStorage.setItem(key, legacyRaw);
  return true;
}
