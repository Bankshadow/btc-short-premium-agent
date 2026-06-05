import type { OptionGreekSnapshot, StressScenario } from "./types";

const DEFAULT_PRICE_MOVES = [-10, -5, 5, 10];
const DEFAULT_VOL_EXPANSION = [20, 50];

export function runStressScenarios(input: {
  positions: OptionGreekSnapshot[];
  spotPrice: number;
  priceMovesPct?: number[];
  volExpansionPct?: number[];
}): StressScenario[] {
  const scenarios: StressScenario[] = [];
  const spot = input.spotPrice;
  const totalNotional = input.positions.reduce((s, p) => s + p.notionalUsd, 0);

  for (const move of input.priceMovesPct ?? DEFAULT_PRICE_MOVES) {
    let pnl = 0;
    for (const p of input.positions) {
      const pricePnl = p.delta * (spot * (move / 100));
      const gammaPnl = 0.5 * p.gamma * Math.pow(spot * (move / 100), 2);
      pnl += pricePnl + gammaPnl;
    }
    scenarios.push({
      id: `price_${move}`,
      label: `Spot ${move >= 0 ? "+" : ""}${move}%`,
      type: "price_move",
      parameter: `${move}%`,
      stressPnlUsd: Number(pnl.toFixed(2)),
      stressPnlPct:
        totalNotional > 0
          ? Number(((pnl / totalNotional) * 100).toFixed(2))
          : 0,
      description: `Portfolio PnL if BTC spot moves ${move}%.`,
    });
  }

  for (const vol of input.volExpansionPct ?? DEFAULT_VOL_EXPANSION) {
    let pnl = 0;
    for (const p of input.positions) {
      pnl += p.vega * vol;
    }
    scenarios.push({
      id: `vol_+${vol}`,
      label: `IV +${vol}%`,
      type: "vol_expansion",
      parameter: `+${vol}%`,
      stressPnlUsd: Number(pnl.toFixed(2)),
      stressPnlPct:
        totalNotional > 0
          ? Number(((pnl / totalNotional) * 100).toFixed(2))
          : 0,
      description: `Portfolio PnL if implied vol expands ${vol}%.`,
    });
  }

  const nearExpiry = input.positions.filter(
    (p) => p.hoursToExpiry != null && p.hoursToExpiry < 24,
  );
  if (nearExpiry.length > 0) {
    const thetaBurn = nearExpiry.reduce((s, p) => s + p.theta, 0);
    scenarios.push({
      id: "expiry_24h",
      label: "Expiry < 24h",
      type: "expiry",
      parameter: `${nearExpiry.length} position(s)`,
      stressPnlUsd: Number(thetaBurn.toFixed(2)),
      stressPnlPct:
        totalNotional > 0
          ? Number(((thetaBurn / totalNotional) * 100).toFixed(2))
          : 0,
      description: "Estimated theta burn for positions expiring within 24h.",
    });
  }

  return scenarios;
}
