import type {
  DrawdownScenarioId,
  DrawdownSimulatorOutput,
  DrawdownStressResult,
} from "./types";

function applyLossStreak(
  equity: number,
  losses: number,
  riskPct: number,
  lossR: number,
): { equity: number; drawdownPct: number } {
  let peak = equity;
  let e = equity;
  for (let i = 0; i < losses; i++) {
    e *= 1 - (riskPct / 100) * lossR;
    if (e > peak) peak = e;
  }
  const dd = peak > 0 ? ((peak - e) / peak) * 100 : 0;
  return { equity: e, drawdownPct: dd };
}

export function runDrawdownSimulator(input: {
  currentEquity: number;
  riskPerTradePct: number;
  averageLossR?: number;
  maxDrawdownPct?: number;
}): DrawdownSimulatorOutput {
  const risk = input.riskPerTradePct;
  const lossR = input.averageLossR ?? 1;
  const maxDd = input.maxDrawdownPct ?? 12;
  const start = input.currentEquity;

  const scenarios: Array<{
    id: DrawdownScenarioId;
    label: string;
    losses: number;
    extraVolatility?: boolean;
    aggressive?: boolean;
  }> = [
    { id: "three_losses", label: "3 losses in a row", losses: 3 },
    { id: "five_losses", label: "5 losses in a row", losses: 5 },
    { id: "ten_losses", label: "10 losses in a row", losses: 10 },
    { id: "volatile_week", label: "High volatility week (mixed)", losses: 4 },
    { id: "aggressive_failure", label: "Aggressive mode failure", losses: 6, aggressive: true },
  ];

  const results: DrawdownStressResult[] = scenarios.map((s) => {
    const effectiveRisk = s.aggressive ? risk * 1.5 : risk;
    let { equity, drawdownPct } = applyLossStreak(
      start,
      s.losses,
      effectiveRisk,
      lossR,
    );
    if (s.id === "volatile_week") {
      equity = start * (1 - (effectiveRisk / 100) * lossR * 2.2);
      drawdownPct = ((start - equity) / start) * 100;
    }
    const killSwitchTrigger = drawdownPct >= maxDd || drawdownPct >= 10;
    const cooldownRecommendation =
      drawdownPct >= maxDd
        ? "24h desk cooldown — kill switch territory."
        : drawdownPct >= 6
          ? "4h cooldown before next TRADE candidate."
          : "No mandatory cooldown — monitor next session.";

    return {
      scenarioId: s.id,
      label: s.label,
      endingEquity: Number(equity.toFixed(0)),
      drawdownPct: Number(drawdownPct.toFixed(1)),
      cooldownRecommendation,
      killSwitchTrigger,
    };
  });

  return { startingEquity: start, results };
}
