import type { AnalyzeApiResponse } from "@/lib/types/market";
import { buildDecisionLogEntry } from "@/lib/journal/decision-log";
import { buildDeskPortfolioSnapshot } from "@/lib/portfolio/milestones";
import { loadPaperOrders } from "@/lib/paper/paper-orders";
import { formatStrategyLabel } from "@/lib/decision/verdict-display";

function formatUsd(value: number): string {
  return `$${value.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Bangkok",
  });
}

function formatTopReasons(reasons: string[]): string {
  if (reasons.length === 0) return "—";
  return reasons.map((r, i) => `${i + 1}. ${r}`).join("\n");
}

/** MVP 6 — rich cron / Telegram desk briefing. */
export function formatDeskBriefing(
  data: AnalyzeApiResponse,
  options?: { paperOrders?: ReturnType<typeof loadPaperOrders> },
): string {
  const entry = buildDecisionLogEntry(data);
  const desk = data.tradingDesk;
  const market = data.step1_marketSnapshot;
  const orders = options?.paperOrders ?? [];
  const portfolio = buildDeskPortfolioSnapshot([entry], orders);
  const achieved = portfolio.milestones.filter((m) => m.status === "achieved");

  const lines = [
    "━━ BTC Premium Trading Desk ━━",
    `🕐 ${formatTimestamp(entry.timestamp)} (Bangkok)`,
    "",
    "▸ COMMITTEE",
    `Verdict: ${entry.finalVerdict}${entry.riskVeto ? " · ⛔ RISK VETO" : ""}`,
    `Regime: ${entry.marketRegime}`,
    `Playbook engine: ${entry.finalVerdict === "TRADE" ? "aligned" : "see committee"}`,
    "",
    "▸ RESEARCH (MVP 5)",
    desk?.research
      ? `Quality ${desk.research.dataQualityScore}/100 · ${desk.research.ethCorrelation.summary}`
      : "—",
    ...(desk?.research.summaryBullets.slice(0, 2).map((b) => `• ${b}`) ?? []),
    "",
    "▸ MARKET",
    `BTC ${entry.btcPrice > 0 ? formatUsd(entry.btcPrice) : "n/a"}`,
    `IV/HV ${market.ivHvRatio > 0 ? market.ivHvRatio.toFixed(2) : "n/a"}`,
    `Liq 24h ${data.liquidation.liquidation24h != null ? formatUsd(data.liquidation.liquidation24h) : "manual/missing"}`,
    "",
    "▸ TOP REASONS",
    formatTopReasons(entry.topReasons),
    "",
    "▸ ACTION (hypothetical)",
    entry.actionPlan ||
      (data.step5_verdict.candidate
        ? `${formatStrategyLabel(data.step6_actionPlan.action)} · ${formatUsd(data.step5_verdict.candidate.strike)}`
        : "No trade"),
    "",
    "▸ PAPER BOOK",
    `Open ${portfolio.paper.openCount} · Closed ${portfolio.paper.closedCount}`,
    `Realized ${portfolio.paper.totalRealizedPnlPct >= 0 ? "+" : ""}${portfolio.paper.totalRealizedPnlPct}% · Unrealized ${portfolio.paper.totalUnrealizedPnlPct >= 0 ? "+" : ""}${portfolio.paper.totalUnrealizedPnlPct}%`,
    "",
    "▸ MILESTONES",
    achieved.length > 0
      ? achieved.map((m) => `✓ ${m.title}`).join("\n")
      : "No milestones yet — keep resolving outcomes.",
    "",
    "Analysis-only · human approval · no exchange orders.",
  ];

  return lines.join("\n");
}

/** Backward-compatible wrapper for cron telegram. */
export function formatCronTelegramMessage(data: AnalyzeApiResponse): string {
  return formatDeskBriefing(data);
}
