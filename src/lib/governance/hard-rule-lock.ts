import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import type { PaperOrder } from "@/lib/paper/paper-order-types";
import type { DeskRiskProfile } from "@/lib/desk/desk-risk-policy";
import type { AnalyzeApiResponse } from "@/lib/types/market";
import { evaluateKillSwitch } from "@/lib/validation/kill-switch";
import { VALIDATION_THRESHOLDS } from "@/lib/validation/validation-config";
import type { AgentRecommendation } from "@/lib/agents/types";
import type { HardRuleId, HardRuleLockResult } from "./governance-types";

const STALE_MS = 15 * 60 * 1000;

export const HARD_RULE_LABELS: Record<HardRuleId, string> = {
  stale_market_data: "Stale market data",
  daily_loss_exceeded: "Daily loss exceeded",
  data_quality_critical: "Data quality critical",
  missing_required_risk_data: "Missing required risk data",
};

export function evaluateHardRuleLocks(input: {
  data?: AnalyzeApiResponse | null;
  entries?: DecisionLogEntry[];
  orders?: PaperOrder[];
  riskProfile?: DeskRiskProfile;
}): HardRuleLockResult {
  const activeRules: HardRuleId[] = [];
  const messages: string[] = [];
  const t = VALIDATION_THRESHOLDS;

  const data = input.data;
  const entries = input.entries ?? [];
  const orders = input.orders ?? [];
  const riskProfile = input.riskProfile ?? "balanced";

  if (data) {
    const analyzedAt = data.step5_verdict?.analyzedAt;
    if (analyzedAt) {
      const age = Date.now() - new Date(analyzedAt).getTime();
      if (age > STALE_MS) {
        activeRules.push("stale_market_data");
        messages.push(`Tape age ${Math.round(age / 60000)}m exceeds limit.`);
      }
    }
    if (
      data.sourceErrors?.length > 0 ||
      data.dataSourceIssues?.some((e) =>
        /bybit|ticker|option/i.test(e.source),
      )
    ) {
      if (!activeRules.includes("stale_market_data")) {
        activeRules.push("stale_market_data");
      }
      messages.push("Critical market data source errors present.");
    }

    const missing = data.step5_verdict?.missingData ?? [];
    const liq = data.liquidation?.liquidation24h;
    const spot = data.step1_marketSnapshot?.spotPrice ?? 0;
    if (
      missing.length > 0 ||
      spot <= 0 ||
      liq == null ||
      data.step1_marketSnapshot?.ivHvRatio <= 0
    ) {
      activeRules.push("missing_required_risk_data");
      messages.push(
        missing.length
          ? `Missing: ${missing.join(", ")}`
          : "Spot, IV/HV, or liquidation incomplete.",
      );
    }

    const dq = data.tradingDesk?.research.dataQualityScore;
    if (dq != null && dq < t.dataQualityLockoutScore) {
      activeRules.push("data_quality_critical");
      messages.push(`Data quality ${dq}/100 below ${t.dataQualityLockoutScore}.`);
    }
  }

  const kill = evaluateKillSwitch({
    entries,
    orders,
    riskProfile,
    latestAnalysis: data ?? null,
  });
  if (kill.dailyPnlPct <= t.dailyLossLimitPct) {
    activeRules.push("daily_loss_exceeded");
    messages.push(`Daily PnL ${kill.dailyPnlPct}% ≤ ${t.dailyLossLimitPct}%.`);
  }
  if (kill.activeReasons.includes("data_quality_lockout") && !activeRules.includes("data_quality_critical")) {
    activeRules.push("data_quality_critical");
    messages.push("Kill switch data-quality lockout.");
  }

  const locked = activeRules.length > 0;
  const riskVeto = data?.tradingDesk?.committee.riskVeto ?? false;
  const forcedVerdict: AgentRecommendation = locked
    ? riskVeto ||
        activeRules.includes("daily_loss_exceeded") ||
        activeRules.includes("missing_required_risk_data")
      ? "SKIP"
      : "WAIT"
    : "WAIT";

  return {
    locked,
    activeRules,
    forcedVerdict,
    messages,
  };
}

export function canOverrideVerdict(hardRules: HardRuleLockResult): boolean {
  return !hardRules.locked;
}

export function mergeHardRuleResults(
  a: HardRuleLockResult,
  b: HardRuleLockResult,
): HardRuleLockResult {
  const activeRules = [...new Set([...a.activeRules, ...b.activeRules])];
  const messages = [...new Set([...a.messages, ...b.messages])];
  const locked = activeRules.length > 0;
  const forcedVerdict: AgentRecommendation =
    activeRules.includes("daily_loss_exceeded") ||
    activeRules.includes("missing_required_risk_data")
      ? "SKIP"
      : a.forcedVerdict === "SKIP" || b.forcedVerdict === "SKIP"
        ? "SKIP"
        : "WAIT";
  return { locked, activeRules, forcedVerdict, messages };
}

export function hardRuleSummary(rules: HardRuleId[]): string {
  return rules.map((r) => HARD_RULE_LABELS[r]).join("; ");
}
