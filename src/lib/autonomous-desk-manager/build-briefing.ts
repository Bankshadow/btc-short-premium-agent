import type { DeskAutomationResult } from "@/lib/automation/automation-types";
import type {
  DeskManagerAction,
  LearningSummary,
  OperatorBriefing,
  RiskSummary,
} from "./types";
import { DESK_MANAGER_SAFETY_NOTICE } from "./types";

export function buildOperatorBriefing(input: {
  automation?: DeskAutomationResult | null;
  learning: LearningSummary;
  risk: RiskSummary;
  actions: DeskManagerAction[];
  experimentNotes?: string[];
}): OperatorBriefing {
  const market = input.automation?.analyze?.step1_marketSnapshot;
  const regime =
    input.automation?.analyze?.tradingDesk?.marketRegime ??
    input.automation?.validation?.currentRegimeLabel ??
    "unknown regime";
  const marketSnapshot = market
    ? `BTC $${market.spotPrice.toLocaleString()} · 24h ${market.priceChange24hPct?.toFixed(1) ?? "?"}% · ${regime}`
    : "Market snapshot unavailable this cycle";

  const keyFindings: string[] = [];
  if (input.automation?.summary) {
    keyFindings.push(input.automation.summary);
  }
  if (input.learning.newEvaluations > 0) {
    keyFindings.push(
      `${input.learning.newEvaluations} newly evaluated closed trade(s).`,
    );
  }
  if (input.learning.newRecommendations > 0) {
    keyFindings.push(
      `${input.learning.newRecommendations} learning improvement hint(s).`,
    );
  }

  const pending = input.actions.filter((a) => a.status === "PENDING");
  const topActions =
    pending.length > 0
      ? pending.slice(0, 5).map((a) => `[${a.priority}] ${a.type}: ${a.reason}`)
      : ["No pending operator actions — NO_ACTION"];

  const headline =
    input.risk.escalationLevel === "CRITICAL"
      ? "Risk escalation — review governance and data trust before trading"
      : pending.some((a) => a.priority === "HIGH")
        ? "Action required — high-priority desk items queued"
        : "Desk cycle complete — review briefing and learning updates";

  return {
    generatedAt: new Date().toISOString(),
    headline,
    marketSnapshot,
    keyFindings: keyFindings.slice(0, 6),
    topActions,
    riskNotes: input.risk.notes,
    learningHighlights: input.learning.agentUpdates,
    experimentNotes: input.experimentNotes ?? [],
    safetyNotice: DESK_MANAGER_SAFETY_NOTICE,
  };
}
