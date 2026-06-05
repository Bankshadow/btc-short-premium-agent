import { OPTIONS_RISK_THRESHOLDS } from "./config";
import type {
  MarginEstimate,
  OptionsRiskCheck,
  PortfolioGreeks,
  OptionGreekSnapshot,
} from "./types";

export function runOptionsPortfolioRiskChecks(input: {
  portfolio: PortfolioGreeks;
  margin: MarginEstimate;
  spotPrice: number | null;
  greeksEstimable: boolean;
  marginEstimable: boolean;
}): OptionsRiskCheck[] {
  const checks: OptionsRiskCheck[] = [];
  const t = OPTIONS_RISK_THRESHOLDS;
  const { portfolio, margin } = input;

  checks.push({
    id: "greeks_estimable",
    label: "Greeks estimable",
    status: input.greeksEstimable ? "PASS" : "FAIL",
    message: input.greeksEstimable
      ? `${portfolio.estimablePositionCount}/${portfolio.positionCount} positions with Greeks.`
      : "Greeks cannot be estimated — live options readiness blocked.",
    blocking: !input.greeksEstimable,
  });

  checks.push({
    id: "margin_estimable",
    label: "Margin estimable",
    status: input.marginEstimable ? "PASS" : "FAIL",
    message: input.marginEstimable
      ? `Margin $${margin.totalMarginUsd} estimated.`
      : "Margin cannot be estimated — live options readiness blocked.",
    blocking: !input.marginEstimable,
  });

  const absDelta = Math.abs(portfolio.netDelta);
  checks.push({
    id: "max_delta",
    label: "Max delta exposure",
    status:
      absDelta > t.maxNetDelta
        ? "FAIL"
        : absDelta > t.maxNetDelta * 0.85
          ? "WARNING"
          : "PASS",
    message: `Net Δ ${portfolio.netDelta} (cap ${t.maxNetDelta}).`,
    blocking: absDelta > t.maxNetDelta,
  });

  const absGamma = Math.abs(portfolio.netGamma);
  checks.push({
    id: "max_gamma",
    label: "Max gamma exposure",
    status: absGamma > t.maxNetGamma ? "FAIL" : "PASS",
    message: `Net Γ ${portfolio.netGamma} (cap ${t.maxNetGamma}).`,
    blocking: absGamma > t.maxNetGamma,
  });

  const absVega = Math.abs(portfolio.netVega);
  checks.push({
    id: "max_vega",
    label: "Max vega exposure",
    status: absVega > t.maxNetVega ? "FAIL" : "PASS",
    message: `Net V ${portfolio.netVega} (cap ${t.maxNetVega}).`,
    blocking: absVega > t.maxNetVega,
  });

  if (margin.marginUsagePct != null) {
    checks.push({
      id: "max_margin",
      label: "Max margin usage",
      status:
        margin.marginUsagePct > t.maxMarginUsagePct
          ? "FAIL"
          : margin.marginUsagePct > t.maxMarginUsagePct * 0.85
            ? "WARNING"
            : "PASS",
      message: `Margin ${margin.marginUsagePct}% (cap ${t.maxMarginUsagePct}%).`,
      blocking: margin.marginUsagePct > t.maxMarginUsagePct,
    });
  }

  if (portfolio.byExpiry.length > 0) {
    const maxExp = Math.max(
      ...portfolio.byExpiry.map((e) => e.positionCount),
    );
    const concPct = (maxExp / portfolio.positionCount) * 100;
    checks.push({
      id: "expiry_concentration",
      label: "Expiry concentration",
      status: concPct > t.maxExpiryConcentrationPct ? "WARNING" : "PASS",
      message: `${concPct.toFixed(0)}% positions in one expiry bucket.`,
      blocking: false,
    });
  }

  const spot = input.spotPrice ?? 0;
  for (const p of portfolio.byPosition) {
    if (
      p.instrument === "sell_call" &&
      p.strike > 0 &&
      spot > 0 &&
      spot >= p.strike * (1 - t.shortCallDangerSpotPct / 100)
    ) {
      checks.push({
        id: `short_call_danger_${p.positionId}`,
        label: "Short call danger zone",
        status: "WARNING",
        message: `${p.symbol} — spot near/above short call strike.`,
        blocking: false,
      });
      break;
    }
    if (
      p.spotDistancePct != null &&
      p.spotDistancePct < t.spotNearStrikePct
    ) {
      checks.push({
        id: `near_strike_${p.positionId}`,
        label: "Spot near strike",
        status: "WARNING",
        message: `${p.symbol} — spot ${p.spotDistancePct}% from strike (pin risk).`,
        blocking: false,
      });
    }
  }

  return checks;
}

export function summarizeRiskChecks(checks: OptionsRiskCheck[]): {
  overallStatus: "PASS" | "WARNING" | "FAIL";
  blockers: string[];
  cautions: string[];
} {
  const blockers = checks.filter((c) => c.blocking).map((c) => c.message);
  const cautions = checks
    .filter((c) => c.status === "WARNING" && !c.blocking)
    .map((c) => c.message);
  const overallStatus: "PASS" | "WARNING" | "FAIL" = checks.some(
    (c) => c.blocking,
  )
    ? "FAIL"
    : checks.some((c) => c.status === "WARNING")
      ? "WARNING"
      : "PASS";
  return { overallStatus, blockers, cautions };
}
