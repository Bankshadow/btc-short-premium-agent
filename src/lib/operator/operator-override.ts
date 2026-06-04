import type { AgentRecommendation } from "@/lib/agents/types";
import { updateDecisionLogEntry } from "@/lib/journal/decision-log";

export const OPERATOR_OVERRIDE_STORAGE_KEY =
  "trading-agents-crypto-desk:operator-overrides";

export interface OperatorOverride {
  logEntryId: string;
  disagreeWithVerdict: AgentRecommendation;
  reason: string;
  createdAt: string;
}

export function loadOperatorOverrides(): OperatorOverride[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(OPERATOR_OVERRIDE_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as OperatorOverride[];
  } catch {
    return [];
  }
}

export function saveOperatorOverride(
  override: OperatorOverride,
): OperatorOverride[] {
  const existing = loadOperatorOverrides().filter(
    (o) => o.logEntryId !== override.logEntryId,
  );
  const next = [override, ...existing].slice(0, 100);
  if (typeof window !== "undefined") {
    localStorage.setItem(OPERATOR_OVERRIDE_STORAGE_KEY, JSON.stringify(next));
    updateDecisionLogEntry(override.logEntryId, (e) => ({
      ...e,
      operatorOverride: {
        disagreeWithVerdict: override.disagreeWithVerdict,
        reason: override.reason,
        createdAt: override.createdAt,
      },
    }));
  }
  return next;
}

export function getOverrideForLog(logEntryId: string): OperatorOverride | null {
  return loadOperatorOverrides().find((o) => o.logEntryId === logEntryId) ?? null;
}
