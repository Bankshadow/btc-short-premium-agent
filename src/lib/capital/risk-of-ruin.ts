import type { DeskPortfolioSnapshot } from "@/lib/portfolio/portfolio-types";
import type { KillSwitchStatus } from "@/lib/validation/validation-types";
import type { RiskOfRuinWarning } from "./capital-types";
import type { CapitalStageSnapshot } from "./capital-types";

/**
 * Educational ruin-risk estimate from paper stats — not a live risk model.
 */
export function buildRiskOfRuinWarning(input: {
  portfolio: DeskPortfolioSnapshot;
  killSwitch: KillSwitchStatus;
  stage: CapitalStageSnapshot;
  maxRiskPctPerTrade?: number;
}): RiskOfRuinWarning {
  const maxRisk = input.maxRiskPctPerTrade ?? 2.5;
  const resolved = input.portfolio.resolvedLogCount;
  const wins = input.portfolio.streakWins;
  const losses = input.portfolio.streakLosses;
  const dd = input.killSwitch.peakToTroughDrawdownPct;
  const daily = input.killSwitch.dailyPnlPct;
  const paused = input.killSwitch.tradingPaused;

  let score = 12;
  const factors: string[] = [];

  if (resolved < 5) {
    score += 18;
    factors.push("Fewer than 5 resolved sessions — sample too thin for scaling.");
  }
  if (dd > 8) {
    score += 22;
    factors.push(`Peak-to-trough drawdown ${dd}% approaches desk limit.`);
  }
  if (dd > 12) score += 15;
  if (daily <= -2) {
    score += 20;
    factors.push(`Daily PnL ${daily}% — loss cluster risk elevated.`);
  }
  if (losses >= 3) {
    score += 25;
    factors.push(`${losses}-loss streak — playbook pause rules may apply.`);
  }
  if (paused) {
    score += 30;
    factors.push("Kill switch or operator pause active.");
  }
  if (input.stage.equityUsd < input.stage.missionStartUsd * 1.1) {
    score += 8;
    factors.push("Equity still near mission start — preserve reserve.");
  }
  if (maxRisk > 3) {
    score += 10;
    factors.push(`Assumed ${maxRisk}% risk per trade increases ruin path length.`);
  }
  if (wins >= 3 && dd < 5) score -= 8;

  score = Math.min(100, Math.max(0, score));

  let level: RiskOfRuinWarning["level"] = "low";
  if (score >= 70) level = "critical";
  else if (score >= 50) level = "high";
  else if (score >= 30) level = "moderate";

  const headline =
    level === "critical"
      ? "Ruin path elevated — do not scale capital sleeves."
      : level === "high"
        ? "Caution — reduce size until drawdown and overrides stabilize."
        : level === "moderate"
          ? "Moderate tail risk — stay on paper until more resolved edge."
          : "Ruin indicators within planning band — still paper-first.";

  return {
    level,
    score,
    headline,
    factors: factors.length
      ? factors
      : ["No major ruin flags from current paper + log stats."],
    disclaimer:
      "Simulation only. Does not move funds or open subaccounts. Not financial advice.",
  };
}
