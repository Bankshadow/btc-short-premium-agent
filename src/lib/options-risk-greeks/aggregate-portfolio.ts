import type { OptionGreekSnapshot, PortfolioGreeks } from "./types";

export function aggregatePortfolioGreeks(
  positions: OptionGreekSnapshot[],
): PortfolioGreeks {
  const byExpiryMap = new Map<
    string,
    { netDelta: number; netGamma: number; netTheta: number; netVega: number; count: number }
  >();
  const byStrikeMap = new Map<
    number,
    { netDelta: number; netGamma: number; count: number }
  >();

  let netDelta = 0;
  let netGamma = 0;
  let netTheta = 0;
  let netVega = 0;
  let netIvExposure = 0;

  for (const p of positions) {
    netDelta += p.delta;
    netGamma += p.gamma;
    netTheta += p.theta;
    netVega += p.vega;
    netIvExposure += p.ivExposureUsd;

    const exp = byExpiryMap.get(p.expiry) ?? {
      netDelta: 0,
      netGamma: 0,
      netTheta: 0,
      netVega: 0,
      count: 0,
    };
    exp.netDelta += p.delta;
    exp.netGamma += p.gamma;
    exp.netTheta += p.theta;
    exp.netVega += p.vega;
    exp.count += 1;
    byExpiryMap.set(p.expiry, exp);

    const stk = byStrikeMap.get(p.strike) ?? {
      netDelta: 0,
      netGamma: 0,
      count: 0,
    };
    stk.netDelta += p.delta;
    stk.netGamma += p.gamma;
    stk.count += 1;
    byStrikeMap.set(p.strike, stk);
  }

  return {
    netDelta: Number(netDelta.toFixed(4)),
    netGamma: Number(netGamma.toFixed(6)),
    netThetaPerDay: Number(netTheta.toFixed(4)),
    netVega: Number(netVega.toFixed(4)),
    netIvExposureUsd: Number(netIvExposure.toFixed(2)),
    positionCount: positions.length,
    estimablePositionCount: positions.filter((p) => p.estimable).length,
    byPosition: positions,
    byExpiry: [...byExpiryMap.entries()].map(([expiry, v]) => ({
      expiry,
      netDelta: Number(v.netDelta.toFixed(4)),
      netGamma: Number(v.netGamma.toFixed(6)),
      netTheta: Number(v.netTheta.toFixed(4)),
      netVega: Number(v.netVega.toFixed(4)),
      positionCount: v.count,
    })),
    byStrike: [...byStrikeMap.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([strike, v]) => ({
        strike,
        netDelta: Number(v.netDelta.toFixed(4)),
        netGamma: Number(v.netGamma.toFixed(6)),
        positionCount: v.count,
      })),
  };
}
