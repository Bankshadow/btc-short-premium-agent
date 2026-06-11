import { getRiskMode, hydrateOperatorGateState } from "@/lib/operator/operator-actions";
import type { RiskMode } from "@/lib/operator/operator-types";

export type RiskModeGuardAction = "execute" | "preview";

export async function checkRiskModeGuard(
  action: RiskModeGuardAction,
): Promise<{ blocked: boolean; reason: string | null; mode: RiskMode }> {
  await hydrateOperatorGateState();
  const mode = getRiskMode();

  if (mode === "CONSERVATIVE" && (action === "execute" || action === "preview")) {
    return {
      blocked: true,
      reason: `Risk mode CONSERVATIVE blocks new ${action} — switch to NORMAL to continue.`,
      mode,
    };
  }

  return { blocked: false, reason: null, mode };
}
