import type { GovernanceRuntimeContext } from "./governance-types";

let active: GovernanceRuntimeContext | null = null;

export function applyGovernanceRuntime(ctx: GovernanceRuntimeContext | null): void {
  active = ctx;
}

export function getGovernanceRuntime(): GovernanceRuntimeContext | null {
  return active;
}

export function isGovernanceSafeMode(): boolean {
  return active?.safeMode ?? false;
}

export function isGovernanceAggressiveDisabled(): boolean {
  return active?.disableAggressiveMode ?? false;
}

export function getActiveHardRules(): GovernanceRuntimeContext["hardRules"] | null {
  return active?.hardRules ?? null;
}
