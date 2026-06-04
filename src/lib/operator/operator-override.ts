import type { AgentRecommendation } from "@/lib/agents/types";
import { loadOperatorOverrideLog, saveOperatorOverrideLogEntry } from "@/lib/governance/operator-override-log";
import type { OperatorOverrideLogEntry } from "@/lib/governance/governance-types";

/** @deprecated Use OperatorOverrideLogEntry — kept for MVP 9 compat */
export interface OperatorOverride {
  logEntryId: string;
  disagreeWithVerdict: AgentRecommendation;
  reason: string;
  createdAt: string;
}

export function loadOperatorOverrides(): OperatorOverride[] {
  return loadOperatorOverrideLog().map((o) => ({
    logEntryId: o.logEntryId,
    disagreeWithVerdict: o.overriddenVerdict,
    reason: o.reason,
    createdAt: o.timestamp,
  }));
}

export function saveOperatorOverride(
  override: OperatorOverride & {
    originalVerdict?: AgentRecommendation;
    riskVetoState?: boolean;
  },
): OperatorOverride[] {
  saveOperatorOverrideLogEntry({
    logEntryId: override.logEntryId,
    originalVerdict: override.originalVerdict ?? override.disagreeWithVerdict,
    overriddenVerdict: override.disagreeWithVerdict,
    riskVetoState: override.riskVetoState ?? false,
    reason: override.reason,
  });
  return loadOperatorOverrides();
}

export function getOverrideForLog(logEntryId: string): OperatorOverride | null {
  const row = loadOperatorOverrideLog().find((o) => o.logEntryId === logEntryId);
  if (!row) return null;
  return {
    logEntryId: row.logEntryId,
    disagreeWithVerdict: row.overriddenVerdict,
    reason: row.reason,
    createdAt: row.timestamp,
  };
}

export type { OperatorOverrideLogEntry };
