import type {
  ActionPlan,
  CheckResult,
  CombinationReadResult,
  NoTradeRuleResult,
  TradeRecommendation,
  VerdictOutput,
} from "@/lib/types/market";

export type ConfidenceLevel = "HIGH" | "MEDIUM" | "LOW";

export function resolveConfidenceLevel(
  confidence: number,
  recommendation: TradeRecommendation,
): ConfidenceLevel {
  if (recommendation === "skip" && confidence >= 90) return "HIGH";
  if (recommendation === "trade" && confidence >= 75) return "HIGH";
  if (confidence >= 75) return "HIGH";
  if (confidence >= 50) return "MEDIUM";
  return "LOW";
}

export function collectTopReasons(
  verdict: VerdictOutput,
  checks: CheckResult[],
  noTradeRules: NoTradeRuleResult[],
  combinationRead: CombinationReadResult,
): string[] {
  const reasons: string[] = [];

  for (const rule of noTradeRules) {
    if (rule.triggered && rule.severity === "hard") {
      reasons.push(rule.message);
    }
  }

  for (const check of checks) {
    if (check.status === "fail") {
      reasons.push(check.message);
    }
  }

  if (combinationRead.pattern === "long_capitulation") {
    reasons.push(combinationRead.actionHint);
  } else if (combinationRead.dataStatus === "partial_data") {
    reasons.push(
      `Combination Read partial — missing ${combinationRead.missingFields.join(", ")}`,
    );
  }

  if (verdict.missingData.length > 0) {
    reasons.push(`Required data missing: ${verdict.missingData.join(", ")}`);
  }

  for (const rule of noTradeRules) {
    if (rule.triggered && rule.severity === "soft") {
      reasons.push(rule.message);
    }
  }

  for (const check of checks) {
    if (check.status === "warn") {
      reasons.push(check.message);
    }
  }

  if (reasons.length === 0 && verdict.summary) {
    reasons.push(verdict.summary);
  }

  return [...new Set(reasons)].slice(0, 3);
}

export function resolveActionSummary(
  verdict: VerdictOutput,
  actionPlan: ActionPlan,
): string {
  if (verdict.recommendation === "skip") {
    return actionPlan.entryNotes || "No order recommended.";
  }
  if (verdict.recommendation === "wait") {
    return actionPlan.entryNotes || verdict.summary;
  }
  return (
    actionPlan.entryNotes ||
    verdict.summary ||
    "Hypothetical entry per playbook — analysis only."
  );
}

export function resolveRecheckGuidance(
  verdict: VerdictOutput,
  noTradeRules: NoTradeRuleResult[],
): string {
  if (
    noTradeRules.some((r) => r.id === "liquidation-cascade" && r.triggered)
  ) {
    return "Recheck when 24h liquidation drops below $50M (CoinGlass) or at the next daily analysis (~07:00 TH).";
  }

  if (noTradeRules.some((r) => r.id === "macro-event" && r.triggered)) {
    return "Recheck after FOMC/CPI/NFP passes and before the next 15:00 TH settlement window.";
  }

  if (verdict.missingData.length > 0) {
    return "Recheck once missing data is filled in and click Analyze Now.";
  }

  if (noTradeRules.some((r) => r.id === "iv-hv-min" && r.triggered)) {
    return "Recheck when IV/HV ratio rises above 1.15 (next daily trigger ~07:00 TH).";
  }

  return "Recheck at the next daily trigger (~07:00 TH) or when market regime shifts.";
}

export function formatStrategyLabel(action: ActionPlan["action"]): string {
  switch (action) {
    case "sell_call":
      return "Short Call";
    case "sell_put":
      return "Short Put";
    default:
      return "No trade";
  }
}
