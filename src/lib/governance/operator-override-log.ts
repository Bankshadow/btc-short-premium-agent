import type { AgentRecommendation } from "@/lib/agents/types";
import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import { loadDecisionLog, updateDecisionLogEntry } from "@/lib/journal/decision-log";
import { appendGovernanceAudit } from "./governance-audit-log";
import { evaluateHardRuleLocks, canOverrideVerdict } from "./hard-rule-lock";
import { loadGovernanceState } from "./governance-state";
import type { DeskUserRole, OperatorOverrideLogEntry } from "./governance-types";
import { loadPaperOrders } from "@/lib/paper/paper-orders";
import { loadDeskSettings } from "@/lib/desk/desk-settings";

export const OPERATOR_OVERRIDE_LOG_KEY =
  "trading-agents-crypto-desk:operator-override-log";

export function loadOperatorOverrideLog(): OperatorOverrideLogEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(OPERATOR_OVERRIDE_LOG_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as OperatorOverrideLogEntry[];
  } catch {
    return [];
  }
}

function saveLog(entries: OperatorOverrideLogEntry[]): OperatorOverrideLogEntry[] {
  if (typeof window !== "undefined") {
    localStorage.setItem(OPERATOR_OVERRIDE_LOG_KEY, JSON.stringify(entries));
  }
  return entries;
}

export function saveOperatorOverrideLogEntry(input: {
  logEntryId: string;
  originalVerdict: AgentRecommendation;
  overriddenVerdict: AgentRecommendation;
  riskVetoState: boolean;
  reason: string;
  operatorName?: string;
  operatorRole?: DeskUserRole;
}): { ok: boolean; entry?: OperatorOverrideLogEntry; error?: string } {
  const gov = loadGovernanceState();
  const entry = loadDecisionLog().find((e) => e.id === input.logEntryId);
  const hardRules = evaluateHardRuleLocks({
    entries: loadDecisionLog(),
    orders: loadPaperOrders(),
    riskProfile: loadDeskSettings().riskProfile,
  });

  if (!canOverrideVerdict(hardRules)) {
    appendGovernanceAudit({
      action: "override_blocked",
      detail: `Hard rules: ${hardRules.activeRules.join(", ")} — ${input.reason}`,
      actorName: gov.operatorName,
      actorRole: gov.operatorRole,
    });
    return {
      ok: false,
      error: `Override blocked by hard rule lock (${hardRules.activeRules.join(", ")}).`,
    };
  }

  const logEntry: OperatorOverrideLogEntry = {
    id: `ovr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
    logEntryId: input.logEntryId,
    originalVerdict: input.originalVerdict,
    overriddenVerdict: input.overriddenVerdict,
    riskVetoState: input.riskVetoState,
    reason: input.reason.trim(),
    operatorName: input.operatorName ?? gov.operatorName,
    operatorRole: input.operatorRole ?? gov.operatorRole,
    outcomeStatus: entry?.outcomeStatus ?? "PENDING",
    hardRuleBlocked: false,
    hardRuleIds: [],
  };

  const next = [logEntry, ...loadOperatorOverrideLog()].slice(0, 150);
  saveLog(next);

  updateDecisionLogEntry(input.logEntryId, (e) => ({
    ...e,
    operatorOverride: {
      disagreeWithVerdict: input.overriddenVerdict,
      reason: input.reason.trim(),
      createdAt: logEntry.timestamp,
      operatorName: logEntry.operatorName,
      originalVerdict: input.originalVerdict,
      riskVetoState: input.riskVetoState,
    },
  }));

  appendGovernanceAudit({
    action: "operator_override",
    detail: `${input.originalVerdict} → ${input.overriddenVerdict}: ${input.reason}`,
    actorName: logEntry.operatorName,
    actorRole: logEntry.operatorRole,
  });

  return { ok: true, entry: logEntry };
}

export function syncOverrideOutcomeStatuses(): void {
  const logs = loadOperatorOverrideLog();
  const entries = loadDecisionLog();
  let changed = false;
  const next = logs.map((row) => {
    const e = entries.find((x) => x.id === row.logEntryId);
    if (e && e.outcomeStatus !== row.outcomeStatus) {
      changed = true;
      return { ...row, outcomeStatus: e.outcomeStatus };
    }
    return row;
  });
  if (changed) saveLog(next);
}

export function enrichLogFromEntries(
  entries: DecisionLogEntry[],
): OperatorOverrideLogEntry[] {
  return loadOperatorOverrideLog().map((row) => {
    const e = entries.find((x) => x.id === row.logEntryId);
    return e ? { ...row, outcomeStatus: e.outcomeStatus } : row;
  });
}
