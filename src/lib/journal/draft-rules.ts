import type { StructuredReflection } from "./decision-log-types";

export const DRAFT_RULES_STORAGE_KEY =
  "trading-agents-crypto-desk:draft-rules";

export type DraftRuleStatus = "draft" | "approved" | "rejected";

/**
 * Draft rules are NEVER applied to live analyze — human must approve first.
 * Even "approved" rules stay advisory until engine integration is explicitly added.
 */
export interface DraftRule {
  id: string;
  sourceEntryId: string;
  createdAt: string;
  status: DraftRuleStatus;
  title: string;
  description: string;
  fromReflection: boolean;
}

export function loadDraftRules(): DraftRule[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(DRAFT_RULES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as DraftRule[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveDraftRules(rules: DraftRule[]): DraftRule[] {
  if (typeof window === "undefined") return rules;
  localStorage.setItem(DRAFT_RULES_STORAGE_KEY, JSON.stringify(rules));
  return rules;
}

export function createDraftRuleFromReflection(
  entryId: string,
  reflection: StructuredReflection,
): DraftRule {
  const rule: DraftRule = {
    id: `rule-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    sourceEntryId: entryId,
    createdAt: new Date().toISOString(),
    status: "draft",
    title: `Learned rule · ${new Date().toLocaleDateString()}`,
    description: reflection.suggestedDraftRule,
    fromReflection: true,
  };
  saveDraftRules([rule, ...loadDraftRules()]);
  return rule;
}

export function updateDraftRuleStatus(
  id: string,
  status: DraftRuleStatus,
): DraftRule[] {
  const next = loadDraftRules().map((r) =>
    r.id === id ? { ...r, status } : r,
  );
  return saveDraftRules(next);
}

/** Approved rules are stored for display only — not wired into runTradingDesk. */
export function getApprovedRulesForDisplay(): DraftRule[] {
  return loadDraftRules().filter((r) => r.status === "approved");
}
