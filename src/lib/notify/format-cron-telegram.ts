import type { AnalyzeApiResponse } from "@/lib/types/market";
import { buildDecisionLogEntry } from "@/lib/journal/decision-log";
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

function formatLiquidation(value: number | null): string {
  if (value === null) return "missing";
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M`;
  }
  return formatUsd(value);
}

function formatTopReasons(reasons: string[]): string {
  if (reasons.length === 0) return "1. No specific blockers recorded.";
  return reasons
    .map((reason, index) => `${index + 1}. ${reason}`)
    .join("\n");
}

function formatActionSection(data: AnalyzeApiResponse): string {
  const verdict = data.step5_verdict;
  const plan = data.step6_actionPlan;
  const candidate = verdict.candidate;

  if (verdict.recommendation === "skip") {
    return plan.entryNotes || "No order recommended.";
  }

  if (verdict.recommendation === "wait") {
    return plan.entryNotes
      ? `Wait — ${plan.entryNotes}`
      : `Wait — ${verdict.summary}`;
  }

  if (!candidate) {
    return plan.entryNotes || "Suggested trade plan unavailable (no candidate).";
  }

  const lines = [
    `${formatStrategyLabel(plan.action)} · ${formatUsd(candidate.strike)} · exp ${candidate.expiry}`,
    `Entry premium: bid ${formatUsd(candidate.bid)} / mark ${formatUsd(candidate.markPrice)}`,
    `SL: Index Price ${formatUsd(plan.slIndexPrice)} (never Mark Price)`,
    `Forced exit: ${plan.pinExitTimeTh} TH · settlement ${plan.settlementTimeTh} TH`,
    `Size: ${plan.suggestedSizePct}% of portfolio${verdict.caution ? " (reduced — caution)" : ""}`,
  ];

  return lines.join("\n");
}

/** Telegram body for cron / scheduled analysis alerts. */
export function formatCronTelegramMessage(data: AnalyzeApiResponse): string {
  const entry = buildDecisionLogEntry(data);
  const market = data.step1_marketSnapshot;

  return [
    "Multi-Agent AI Trading Desk",
    `Time: ${formatTimestamp(entry.timestamp)}`,
    "",
    `Committee: ${entry.finalVerdict}`,
    entry.riskVeto ? "Risk veto: YES" : "Risk veto: no",
    `Regime: ${entry.marketRegime}`,
    "",
    `BTC: ${entry.btcPrice > 0 ? formatUsd(entry.btcPrice) : "missing"}`,
    `IV/HV: ${market.ivHvRatio > 0 ? market.ivHvRatio.toFixed(2) : "missing"}`,
    `Liquidation: ${formatLiquidation(data.liquidation.liquidation24h)}`,
    "",
    "Top Reasons:",
    formatTopReasons(entry.topReasons),
    "",
    "Action:",
    entry.actionPlan || formatActionSection(data),
    "",
    "Analysis-only. No auto-trading.",
  ].join("\n");
}
