import { evaluateNoTradeRules } from "@/lib/rules/no-trade-rule-engine";

export async function checkNoTradeRuleGuard(): Promise<{ blocked: boolean; reason: string | null }> {
  const result = await evaluateNoTradeRules({
    proposedVerdict: "TRADE",
    swarmAgreement: "NEUTRAL",
    regime: "UNKNOWN",
  });
  if (result.blocked) {
    return {
      blocked: true,
      reason: result.blockReason ?? result.message ?? "No-trade rule triggered.",
    };
  }
  return { blocked: false, reason: null };
}
