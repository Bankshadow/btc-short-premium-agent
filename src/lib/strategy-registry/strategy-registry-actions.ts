import type { StrategyId } from "@/lib/validation/validation-types";
import { loadDraftRules, saveDraftRules } from "@/lib/journal/draft-rules";
import { patchStrategyOverride } from "./strategy-registry-store";
import {
  nextDemoteStatus,
  nextPromoteStatus,
} from "./strategy-registry-status";
import type {
  StrategyRegistryStatus,
  StrategySkill,
} from "./strategy-registry-types";

function setStatus(
  id: StrategyId,
  status: StrategyRegistryStatus,
  note: string,
): void {
  patchStrategyOverride(
    id,
    { status, statusLocked: true },
    note,
  );
}

export function promoteStrategy(skill: StrategySkill): StrategyRegistryStatus | null {
  const next = nextPromoteStatus(skill.status);
  if (!next) return null;
  setStatus(skill.id, next, `Promoted ${skill.status} → ${next}`);
  return next;
}

export function demoteStrategy(skill: StrategySkill): StrategyRegistryStatus | null {
  const next = nextDemoteStatus(skill.status);
  if (!next) return null;
  setStatus(skill.id, next, `Demoted ${skill.status} → ${next}`);
  return next;
}

export function disableStrategy(skill: StrategySkill): void {
  setStatus(skill.id, "DISABLED", "Operator disabled strategy");
}

export function deprecateStrategy(skill: StrategySkill): void {
  setStatus(skill.id, "DEPRECATED", "Marked deprecated");
}

export function linkDraftRuleToStrategy(
  strategyId: StrategyId,
  ruleId: string,
): string[] {
  const persisted = patchStrategyOverride(strategyId, {});
  const current = persisted.overrides[strategyId]?.linkedDraftRules ?? [];
  if (current.includes(ruleId)) return current;
  const linked = [...current, ruleId];
  patchStrategyOverride(strategyId, { linkedDraftRules: linked });

  const rules = loadDraftRules().map((r) =>
    r.id === ruleId ? { ...r, linkedStrategyId: strategyId } : r,
  );
  saveDraftRules(rules);
  return linked;
}

export function unlinkDraftRuleFromStrategy(
  strategyId: StrategyId,
  ruleId: string,
): string[] {
  const persisted = patchStrategyOverride(strategyId, {});
  const current = persisted.overrides[strategyId]?.linkedDraftRules ?? [];
  const linked = current.filter((id) => id !== ruleId);
  patchStrategyOverride(strategyId, { linkedDraftRules: linked });

  const rules = loadDraftRules().map((r) =>
    r.id === ruleId ? { ...r, linkedStrategyId: undefined } : r,
  );
  saveDraftRules(rules);
  return linked;
}

export function unlockAutoStatus(strategyId: StrategyId): void {
  patchStrategyOverride(strategyId, { statusLocked: false });
}
