import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import type {
  CanonicalRegime,
  RegimePerformanceRow,
  StrategyId,
} from "./validation-types";
import { STRATEGY_LABELS } from "./validation-config";

export interface RegimeRouterRule {
  regime: CanonicalRegime;
  label: string;
  allowed: StrategyId[];
  blocked: boolean;
  sizeMultiplier: number;
  note: string;
}

export const REGIME_ROUTER_RULES: RegimeRouterRule[] = [
  {
    regime: "quiet_range",
    label: "Quiet Range",
    allowed: ["options_short_premium"],
    blocked: false,
    sizeMultiplier: 1,
    note: "Favor short premium in range-bound tape.",
  },
  {
    regime: "bull_trend",
    label: "Bull Trend",
    allowed: ["spot", "futures_long", "eth_btc"],
    blocked: false,
    sizeMultiplier: 1,
    note: "Spot / tactical long perp bias.",
  },
  {
    regime: "bear_trend",
    label: "Bear Trend",
    allowed: ["futures_short", "options_short_premium"],
    blocked: false,
    sizeMultiplier: 1,
    note: "Short perp + short call premium discipline.",
  },
  {
    regime: "high_vol_cascade",
    label: "High Vol / Liquidation Cascade",
    allowed: [],
    blocked: true,
    sizeMultiplier: 0,
    note: "No trade — cascade risk.",
  },
  {
    regime: "post_cascade",
    label: "Post-Cascade",
    allowed: ["options_short_premium"],
    blocked: false,
    sizeMultiplier: 0.5,
    note: "WAIT or reduced size until vol normalizes.",
  },
  {
    regime: "macro_risk_day",
    label: "Macro Risk Day",
    allowed: [],
    blocked: true,
    sizeMultiplier: 0,
    note: "No trade or cut risk — macro event window.",
  },
  {
    regime: "mixed_unclear",
    label: "Mixed / Unclear",
    allowed: ["options_short_premium"],
    blocked: false,
    sizeMultiplier: 0.75,
    note: "Reduced size; committee likely WAIT.",
  },
];

export function normalizeRegimeLabel(raw: string): CanonicalRegime {
  const s = raw.toLowerCase();
  if (s.includes("macro") || s.includes("caution")) return "macro_risk_day";
  if (s.includes("liquidation") || s.includes("stress") || s.includes("capitulation")) {
    if (s.includes("capitulation") && !s.includes("long")) return "high_vol_cascade";
    return "high_vol_cascade";
  }
  if (s.includes("post") && s.includes("cascade")) return "post_cascade";
  if (s.includes("risk-on") || s.includes("bull")) return "bull_trend";
  if (s.includes("risk-off") || s.includes("bear")) return "bear_trend";
  if (s.includes("range")) return "quiet_range";
  return "mixed_unclear";
}

export function getRegimeRule(regime: CanonicalRegime): RegimeRouterRule {
  return (
    REGIME_ROUTER_RULES.find((r) => r.regime === regime) ??
    REGIME_ROUTER_RULES[REGIME_ROUTER_RULES.length - 1]
  );
}

export function isStrategyAllowedInRegime(
  strategyId: StrategyId,
  regime: CanonicalRegime,
): boolean {
  const rule = getRegimeRule(regime);
  if (rule.blocked) return false;
  return rule.allowed.includes(strategyId);
}

export function buildRegimePerformance(
  entries: DecisionLogEntry[],
): RegimePerformanceRow[] {
  const byRegime = new Map<
    CanonicalRegime,
    { sessions: number; resolved: number; wins: number; net: number }
  >();

  for (const entry of entries) {
    const canon = normalizeRegimeLabel(entry.marketRegime);
    const row = byRegime.get(canon) ?? {
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
    byRegime.set(canon, row);
  }

  return REGIME_ROUTER_RULES.map((rule) => {
    const stats = byRegime.get(rule.regime) ?? {
      sessions: 0,
      resolved: 0,
      wins: 0,
      net: 0,
    };
    const winRate =
      stats.resolved > 0
        ? Math.round((stats.wins / stats.resolved) * 100)
        : 0;
    return {
      regime: rule.regime,
      label: rule.label,
      sessions: stats.sessions,
      resolved: stats.resolved,
      winRate,
      netPnlPct: Number(stats.net.toFixed(2)),
      allowedStrategies: rule.allowed,
      routerNote: rule.note,
    };
  }).filter((r) => r.sessions > 0 || r.regime !== "mixed_unclear");
}

export function formatAllowedStrategies(ids: StrategyId[]): string {
  return ids.map((id) => STRATEGY_LABELS[id]).join(", ") || "None";
}
