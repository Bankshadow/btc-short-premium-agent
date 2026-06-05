import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import type { RegimeBrainInput, RegimeBrainReport, RegimePerformanceSlice, RegimeTaxonomy } from "./types";
import { REGIME_BRAIN_SAFETY_NOTICE } from "./types";
import { detectMarketRegime } from "./detect-regime";
import { taxonomyToDeskLabel } from "./route-strategies";

const TAXONOMY_LABELS: RegimeTaxonomy[] = [
  "BULL_TREND",
  "BEAR_TREND",
  "SIDEWAYS",
  "HIGH_VOLATILITY",
  "LOW_VOLATILITY",
  "VOL_EXPANSION",
  "VOL_COMPRESSION",
  "LIQUIDATION_RISK",
  "MACRO_EVENT_RISK",
  "BREAKOUT_RISK",
  "RANGE_BOUND_PREMIUM_SELLING",
];

function inferTaxonomyFromDeskLabel(label: string): RegimeTaxonomy {
  const lower = label.toLowerCase();
  if (lower.includes("risk-on") || lower.includes("bull")) return "BULL_TREND";
  if (lower.includes("risk-off") || lower.includes("bear")) return "BEAR_TREND";
  if (lower.includes("liquidation")) return "LIQUIDATION_RISK";
  if (lower.includes("macro")) return "MACRO_EVENT_RISK";
  if (lower.includes("premium")) return "RANGE_BOUND_PREMIUM_SELLING";
  if (lower.includes("range")) return "SIDEWAYS";
  if (lower.includes("vol expansion")) return "VOL_EXPANSION";
  if (lower.includes("high vol")) return "HIGH_VOLATILITY";
  return "SIDEWAYS";
}

export function buildRegimePerformance(
  entries: DecisionLogEntry[],
): RegimePerformanceSlice[] {
  const byRegime = new Map<
    RegimeTaxonomy,
    { sessions: number; resolved: number; wins: number; net: number }
  >();

  for (const entry of entries) {
    const tax = inferTaxonomyFromDeskLabel(entry.marketRegime);
    const row = byRegime.get(tax) ?? {
      sessions: 0,
      resolved: 0,
      wins: 0,
      net: 0,
    };
    row.sessions += 1;
    if (entry.outcomeStatus === "RESOLVED") {
      row.resolved += 1;
      const pnl = entry.paperPnl ?? 0;
      row.net += pnl;
      if (pnl > 0 || entry.resolution?.tradeWouldWin === true) row.wins += 1;
    }
    byRegime.set(tax, row);
  }

  return TAXONOMY_LABELS.map((regime) => {
    const stats = byRegime.get(regime) ?? {
      sessions: 0,
      resolved: 0,
      wins: 0,
      net: 0,
    };
    return {
      regime,
      label: taxonomyToDeskLabel(regime),
      sessions: stats.sessions,
      resolved: stats.resolved,
      winRate:
        stats.resolved > 0
          ? Math.round((stats.wins / stats.resolved) * 100)
          : 0,
      netPnlPct: Number(stats.net.toFixed(2)),
    };
  }).filter((r) => r.sessions > 0);
}

export function buildRegimeBrainReport(input: {
  brainInput: RegimeBrainInput;
  history?: import("./types").RegimeHistoryEntry[];
  entries?: DecisionLogEntry[];
}): RegimeBrainReport {
  const current = detectMarketRegime(input.brainInput);
  return {
    generatedAt: new Date().toISOString(),
    current,
    history: input.history ?? [],
    regimePerformance: buildRegimePerformance(input.entries ?? input.brainInput.recentEntries ?? []),
    safetyNotice: REGIME_BRAIN_SAFETY_NOTICE,
  };
}
