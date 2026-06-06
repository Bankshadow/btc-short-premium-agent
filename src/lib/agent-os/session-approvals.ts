import type { AgentOsAction } from "./types";

const SESSION_KEY = "btc-desk:agent-os-session-approvals";
const ONCE_PREFIX = "btc-desk:agent-os-once-";

const SESSION_SAFE_ACTIONS: AgentOsAction[] = [
  "CREATE_TESTNET_PREVIEW",
  "EXECUTE_TESTNET_ORDER",
  "CLOSE_TESTNET_POSITION",
];

export function isSessionSafeAction(action: AgentOsAction): boolean {
  return SESSION_SAFE_ACTIONS.includes(action);
}

export function loadSessionApprovals(): AgentOsAction[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as AgentOsAction[]) : [];
  } catch {
    return [];
  }
}

export function grantSessionApproval(action: AgentOsAction): void {
  if (typeof window === "undefined") return;
  const current = loadSessionApprovals();
  if (!current.includes(action)) {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify([...current, action]));
  }
}

export function grantOnceApproval(action: AgentOsAction): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(`${ONCE_PREFIX}${action}`, "1");
}

export function hasOnceApproval(action: AgentOsAction): boolean {
  if (typeof window === "undefined") return false;
  return sessionStorage.getItem(`${ONCE_PREFIX}${action}`) === "1";
}

export function consumeOnceApproval(action: AgentOsAction): boolean {
  if (!hasOnceApproval(action)) return false;
  sessionStorage.removeItem(`${ONCE_PREFIX}${action}`);
  return true;
}

export function hasSessionApproval(action: AgentOsAction): boolean {
  return loadSessionApprovals().includes(action);
}

export function clearSessionApprovals(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(SESSION_KEY);
}
