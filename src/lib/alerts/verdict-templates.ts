import type { AgentRecommendation } from "@/lib/agents/types";
import type { AnalyzeApiResponse } from "@/lib/types/market";

export function formatVerdictAlertTitle(
  verdict: AgentRecommendation,
  riskVeto: boolean,
): string {
  if (riskVeto) return "⛔ DESK · RISK VETO";
  if (verdict === "TRADE") return "✅ DESK · TRADE";
  if (verdict === "SKIP") return "🛑 DESK · SKIP";
  return "⏸ DESK · WAIT";
}

export function formatVerdictAlertBody(
  data: AnalyzeApiResponse,
  options?: { includeBriefing?: boolean },
): string {
  const desk = data.tradingDesk;
  const verdict = desk?.committee.finalVerdict ?? "WAIT";
  const veto = desk?.committee.riskVeto ?? false;
  const market = data.step1_marketSnapshot;
  const lines = [
    formatVerdictAlertTitle(verdict, veto),
    "",
    `BTC ${market.spotPrice > 0 ? `$${market.spotPrice.toLocaleString()}` : "n/a"}`,
    `Regime: ${desk?.marketRegime ?? "—"}`,
    `IV/HV ${market.ivHvRatio > 0 ? market.ivHvRatio.toFixed(2) : "n/a"}`,
    "",
    ...(desk?.committee.topReasons.slice(0, 3).map((r, i) => `${i + 1}. ${r}`) ?? []),
  ];

  if (verdict === "TRADE" && data.step6_actionPlan.action !== "no_trade") {
    lines.push("", `Action: ${data.step6_actionPlan.action} · ${data.step6_actionPlan.suggestedSizePct}%`);
  }

  const summary = desk?.committee.consensusSummary;
  if (options?.includeBriefing && summary) {
    lines.push("", summary);
  }

  return lines.join("\n");
}
