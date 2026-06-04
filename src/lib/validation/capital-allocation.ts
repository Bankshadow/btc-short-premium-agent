import type { DeskPortfolioSnapshot } from "@/lib/portfolio/portfolio-types";
import type { DeskScoreboard } from "@/lib/journal/agent-scoreboard";
import type {
  CapitalAllocationRecommendation,
  KillSwitchStatus,
  StrategyId,
  StrategyPerformanceRow,
} from "./validation-types";
import { VALIDATION_THRESHOLDS } from "./validation-config";
import type { CanonicalRegime } from "./validation-types";
import { getRegimeRule } from "./regime-router";

export function buildCapitalAllocation(input: {
  strategyMatrix: StrategyPerformanceRow[];
  scoreboard: DeskScoreboard;
  portfolio: DeskPortfolioSnapshot;
  killSwitch: KillSwitchStatus;
  currentRegime: CanonicalRegime;
}): CapitalAllocationRecommendation {
  const { strategyMatrix, scoreboard, portfolio, killSwitch, currentRegime } =
    input;
  const t = VALIDATION_THRESHOLDS;

  if (killSwitch.tradingPaused) {
    return {
      reservePct: 100,
      coreStrategyPct: 0,
      growthStrategyPct: 0,
      experimentalPct: 0,
      aggressiveModeAllowed: false,
      summary: "Kill switch active — 100% reserve until cooldown clears.",
      coreStrategies: [],
      growthStrategies: [],
    };
  }

  const active = strategyMatrix.filter((s) => s.status === "ACTIVE");
  const watch = strategyMatrix.filter(
    (s) => s.status === "WATCHLIST" || s.status === "EXPERIMENTAL",
  );
  const paperOnly = strategyMatrix.filter(
    (s) => s.status === "PAPER_ONLY" || s.status === "DISABLED",
  );

  const regimeRule = getRegimeRule(currentRegime);
  let reservePct: number = t.minReservePct;
  if (regimeRule.blocked) reservePct = 85;
  else if (regimeRule.sizeMultiplier < 1) reservePct = 40;

  const drawdownPenalty =
    killSwitch.peakToTroughDrawdownPct > 8
      ? 10
      : scoreboard.netPaperPnlPct < -3
        ? 8
        : 0;
  reservePct = Math.min(70, reservePct + drawdownPenalty);

  const milestoneBoost = portfolio.milestones.filter(
    (m) => m.status === "achieved",
  ).length;
  const growthBase = Math.min(35, 15 + milestoneBoost * 3 + active.length * 4);
  const experimentalPct = Math.min(
    t.maxExperimentalPct,
    watch.length * 2 + (paperOnly.length > 2 ? 3 : 0),
  );

  let coreStrategyPct = Math.min(
    55,
    active.length * 12 + (scoreboard.netPaperPnlPct > 0 ? 8 : 0),
  );
  let growthStrategyPct = growthBase;

  const total = reservePct + coreStrategyPct + growthStrategyPct + experimentalPct;
  if (total > 100) {
    const scale = 100 / total;
    coreStrategyPct = Math.round(coreStrategyPct * scale);
    growthStrategyPct = Math.round(growthStrategyPct * scale);
  }

  const aggressiveRow = strategyMatrix.find(
    (s) => s.id === "aggressive_risk_mode",
  );
  const aggressiveModeAllowed =
    !killSwitch.aggressiveBlocked &&
    aggressiveRow?.status !== "DISABLED" &&
    regimeRule.sizeMultiplier >= 0.75 &&
    !regimeRule.blocked;

  const coreStrategies = active
    .filter((s) => s.id !== "aggressive_risk_mode")
    .map((s) => s.id)
    .slice(0, 3);
  const growthStrategies = watch.map((s) => s.id).slice(0, 2);

  return {
    reservePct: Math.round(reservePct),
    coreStrategyPct: Math.round(coreStrategyPct),
    growthStrategyPct: Math.round(growthStrategyPct),
    experimentalPct: Math.round(experimentalPct),
    aggressiveModeAllowed,
    coreStrategies,
    growthStrategies,
    summary: `Reserve ${Math.round(reservePct)}% · Core ${Math.round(coreStrategyPct)}% (${coreStrategies.length} strategies) · Growth ${Math.round(growthStrategyPct)}% · Experimental ${Math.round(experimentalPct)}%. ${aggressiveModeAllowed ? "Aggressive mode permitted." : "Aggressive mode blocked."}`,
  };
}
