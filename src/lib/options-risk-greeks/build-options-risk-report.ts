import { aggregatePortfolioGreeks } from "./aggregate-portfolio";
import { buildGreekSnapshots } from "./build-positions";
import { estimatePortfolioMargin } from "./estimate-margin";
import { runStressScenarios } from "./stress-test";
import { runOptionsPortfolioRiskChecks, summarizeRiskChecks } from "./risk-checks";
import type { OptionsRiskInput, OptionsRiskReport, StressTestInput } from "./types";
import { OPTIONS_RISK_GREEKS_SAFETY_NOTICE } from "./types";

export function buildOptionsRiskReport(
  input: OptionsRiskInput,
): OptionsRiskReport {
  const positions = buildGreekSnapshots(input);
  const portfolio = aggregatePortfolioGreeks(positions);
  const margin = estimatePortfolioMargin({
    positions,
    walletBalanceUsd: input.walletBalanceUsd,
  });

  const greeksEstimable =
    positions.length === 0 ||
    (portfolio.estimablePositionCount === portfolio.positionCount &&
      portfolio.positionCount > 0) ||
    positions.every((p) => p.estimable);

  const marginEstimable =
    margin.estimable &&
    (input.walletBalanceUsd != null || positions.length === 0);

  const spot = input.spotPrice ?? null;
  const stressScenarios = runStressScenarios({
    positions,
    spotPrice: spot ?? 60_000,
  });

  const checks = runOptionsPortfolioRiskChecks({
    portfolio,
    margin,
    spotPrice: spot,
    greeksEstimable: positions.length === 0 ? true : greeksEstimable,
    marginEstimable: positions.length === 0 ? true : marginEstimable,
  });

  const summary = summarizeRiskChecks(checks);
  const liveReadinessBlocked =
    !greeksEstimable || !marginEstimable || summary.overallStatus === "FAIL";

  return {
    generatedAt: new Date().toISOString(),
    overallStatus: summary.overallStatus,
    greeksEstimable: positions.length === 0 ? false : greeksEstimable,
    marginEstimable: positions.length === 0 ? false : marginEstimable,
    portfolio,
    margin,
    stressScenarios,
    checks,
    blockers: summary.blockers,
    cautions: summary.cautions,
    spotPrice: spot,
    safetyNotice: OPTIONS_RISK_GREEKS_SAFETY_NOTICE,
    cannotPlaceOrders: true,
    liveReadinessBlocked,
  };
}

export function buildStressTestReport(input: StressTestInput): OptionsRiskReport {
  const base = buildOptionsRiskReport(input);
  const stressScenarios = runStressScenarios({
    positions: base.portfolio.byPosition,
    spotPrice: input.spotPrice ?? 60_000,
    priceMovesPct: input.priceMovesPct,
    volExpansionPct: input.volExpansionPct,
  });
  return { ...base, stressScenarios };
}
