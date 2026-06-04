import { loadDraftRules, saveDraftRules } from "@/lib/journal/draft-rules";
import type { LossAutopsyResult } from "./types";

/** Autopsy-suggested rules stay DRAFT — never auto-promoted (MVP 18 guardrail). */
export function createDraftRuleFromAutopsy(
  decisionLogId: string,
  autopsy: LossAutopsyResult,
): void {
  if (!autopsy.draftRuleSuggestion?.trim()) return;
  const rules = loadDraftRules();
  const exists = rules.some(
    (r) =>
      r.sourceEntryId === decisionLogId &&
      r.description === autopsy.draftRuleSuggestion,
  );
  if (exists) return;

  saveDraftRules([
    {
      id: `rule-autopsy-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      sourceEntryId: decisionLogId,
      createdAt: new Date().toISOString(),
      status: "draft",
      title: `Loss autopsy · ${autopsy.lossType.replace(/_/g, " ")}`,
      description: autopsy.draftRuleSuggestion,
      fromReflection: false,
    },
    ...rules,
  ]);
}
