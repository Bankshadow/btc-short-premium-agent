import type {
  RiskReplayPricePoint,
  RiskReplayReport,
  RiskReplayScenarioId,
  RiskReplayScenarioResult,
  RiskReplayTradeInput,
} from "./types";

interface ExitDecision {
  exitPrice: number;
  note: string;
}

function sortedPath(path: RiskReplayPricePoint[]): RiskReplayPricePoint[] {
  return [...path]
    .filter((p) => Number.isFinite(p.price) && p.price > 0)
    .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
}

function fallbackPath(input: RiskReplayTradeInput): RiskReplayPricePoint[] {
  const midTs = new Date(
    (Date.parse(input.openedAt) + Date.parse(input.closedAt)) / 2,
  ).toISOString();
  return [
    { timestamp: input.openedAt, price: input.entryPrice },
    { timestamp: midTs, price: (input.entryPrice + input.exitPrice) / 2 },
    { timestamp: input.closedAt, price: input.exitPrice },
  ];
}

function ensurePath(input: RiskReplayTradeInput): RiskReplayPricePoint[] {
  const path = sortedPath(input.marketPricePath);
  return path.length >= 2 ? path : fallbackPath(input);
}

function directionFactor(side: RiskReplayTradeInput["side"]): number {
  return side === "LONG" ? 1 : -1;
}

function pnlForMove(
  input: RiskReplayTradeInput,
  entryPrice: number,
  exitPrice: number,
  sizeMultiplier = 1,
): number {
  const factor = directionFactor(input.side);
  const move = (exitPrice - entryPrice) * factor;
  return move * input.quantity * sizeMultiplier;
}

function riskPerUnit(input: RiskReplayTradeInput): number {
  const explicitStop = input.originalStopTakeProfit.stopLoss;
  if (explicitStop && explicitStop > 0) {
    return Math.max(0.000001, Math.abs(input.entryPrice - explicitStop));
  }
  return Math.max(input.entryPrice * 0.01, 0.000001);
}

function pctFromPnl(input: RiskReplayTradeInput, pnlUsd: number): number {
  if (!input.notionalUsd || input.notionalUsd <= 0) return 0;
  return (pnlUsd / input.notionalUsd) * 100;
}

function fixedStopExit(
  input: RiskReplayTradeInput,
  path: RiskReplayPricePoint[],
): ExitDecision {
  const r = riskPerUnit(input);
  const stop =
    input.side === "LONG" ? input.entryPrice - r : input.entryPrice + r;
  for (const point of path) {
    if (input.side === "LONG" && point.price <= stop) {
      return { exitPrice: stop, note: "Fixed stop-loss triggered." };
    }
    if (input.side === "SHORT" && point.price >= stop) {
      return { exitPrice: stop, note: "Fixed stop-loss triggered." };
    }
  }
  return {
    exitPrice: path[path.length - 1]!.price,
    note: "Fixed stop-loss not triggered; closed at path end.",
  };
}

function trailingStopExit(
  input: RiskReplayTradeInput,
  path: RiskReplayPricePoint[],
): ExitDecision {
  const r = riskPerUnit(input);
  let trail =
    input.side === "LONG" ? input.entryPrice - r : input.entryPrice + r;
  let best = input.entryPrice;
  for (const point of path) {
    if (input.side === "LONG") {
      best = Math.max(best, point.price);
      trail = Math.max(trail, best - r * 0.5);
      if (point.price <= trail) {
        return { exitPrice: trail, note: "Trailing stop exited early." };
      }
    } else {
      best = Math.min(best, point.price);
      trail = Math.min(trail, best + r * 0.5);
      if (point.price >= trail) {
        return { exitPrice: trail, note: "Trailing stop exited early." };
      }
    }
  }
  return {
    exitPrice: path[path.length - 1]!.price,
    note: "Trailing stop held until path end.",
  };
}

function takeProfitExit(
  input: RiskReplayTradeInput,
  path: RiskReplayPricePoint[],
  multipleR: number,
): ExitDecision {
  const r = riskPerUnit(input);
  const target =
    input.side === "LONG"
      ? input.entryPrice + r * multipleR
      : input.entryPrice - r * multipleR;
  for (const point of path) {
    if (input.side === "LONG" && point.price >= target) {
      return { exitPrice: target, note: `Take-profit at ${multipleR}R hit.` };
    }
    if (input.side === "SHORT" && point.price <= target) {
      return { exitPrice: target, note: `Take-profit at ${multipleR}R hit.` };
    }
  }
  return {
    exitPrice: path[path.length - 1]!.price,
    note: `Take-profit ${multipleR}R not hit; exited at path end.`,
  };
}

function earlierExit(path: RiskReplayPricePoint[]): ExitDecision {
  const idx = Math.max(1, Math.floor(path.length * 0.5));
  return {
    exitPrice: path[Math.min(idx, path.length - 1)]!.price,
    note: "Exited at mid-trade checkpoint.",
  };
}

function waitForConfirmationExit(
  input: RiskReplayTradeInput,
  path: RiskReplayPricePoint[],
): { entryPrice: number; exitPrice: number; note: string } {
  const idx = Math.max(1, Math.floor(path.length * 0.25));
  const confirmedEntry = path[Math.min(idx, path.length - 1)]!.price;
  const finalExit = path[path.length - 1]!.price;
  return {
    entryPrice: confirmedEntry,
    exitPrice: finalExit,
    note: "Waited for confirmation before entering.",
  };
}

function buildScenarioResult(input: {
  trade: RiskReplayTradeInput;
  scenarioId: RiskReplayScenarioId;
  label: string;
  simulated: boolean;
  entryPrice: number;
  exitPrice: number;
  pnlUsd: number;
  note: string;
}): RiskReplayScenarioResult {
  return {
    scenarioId: input.scenarioId,
    label: input.label,
    simulated: input.simulated,
    pnlUsd: Number(input.pnlUsd.toFixed(4)),
    pnlPct: Number(pctFromPnl(input.trade, input.pnlUsd).toFixed(4)),
    entryPrice: Number(input.entryPrice.toFixed(6)),
    exitPrice: Number(input.exitPrice.toFixed(6)),
    avoidedLoss: 0,
    missedProfit: 0,
    note: input.note,
  };
}

function recommendedRuleChange(
  actual: RiskReplayScenarioResult,
  simulated: RiskReplayScenarioResult[],
): string {
  const best = simulated.reduce((acc, next) =>
    next.pnlUsd > acc.pnlUsd ? next : acc,
  );
  const improvement = best.pnlUsd - actual.pnlUsd;
  if (improvement <= 0.0001) {
    return "Keep current rule-set; replay does not show clear improvement.";
  }
  if (best.scenarioId === "NO_TRADE") {
    return "Add stricter pre-trade filter to skip similar setups.";
  }
  if (best.scenarioId === "TRAILING_STOP") {
    return "Adopt trailing-stop management for this setup profile.";
  }
  if (best.scenarioId === "FIXED_STOP_LOSS") {
    return "Use fixed stop-loss at 1R to cap downside.";
  }
  if (
    best.scenarioId === "TAKE_PROFIT_1R" ||
    best.scenarioId === "TAKE_PROFIT_2R"
  ) {
    return "Add explicit R-multiple take-profit rule for similar trades.";
  }
  if (best.scenarioId === "WAIT_FOR_CONFIRMATION") {
    return "Require confirmation candle/condition before entry.";
  }
  return `Prefer ${best.label.toLowerCase()} for this setup.`;
}

function confidenceScore(input: {
  pathLength: number;
  actual: RiskReplayScenarioResult;
  best: RiskReplayScenarioResult;
}): number {
  const base = Math.min(35, input.pathLength * 8);
  const edge = Math.min(45, Math.abs(input.best.pnlUsd - input.actual.pnlUsd) * 2);
  return Math.max(35, Math.min(95, Math.round(base + edge + 15)));
}

export function runRiskReplaySimulation(
  trade: RiskReplayTradeInput,
): RiskReplayReport {
  const path = ensurePath(trade);
  const actualPnl = trade.actualPnlUsd;
  const actual = buildScenarioResult({
    trade,
    scenarioId: "ACTUAL",
    label: "Actual result",
    simulated: false,
    entryPrice: trade.entryPrice,
    exitPrice: trade.exitPrice,
    pnlUsd: actualPnl,
    note: "Recorded historical outcome (immutable).",
  });

  const scenarios: RiskReplayScenarioResult[] = [];

  scenarios.push(
    buildScenarioResult({
      trade,
      scenarioId: "SMALLER_SIZE",
      label: "Smaller size (50%)",
      simulated: true,
      entryPrice: trade.entryPrice,
      exitPrice: trade.exitPrice,
      pnlUsd: pnlForMove(trade, trade.entryPrice, trade.exitPrice, 0.5),
      note: "Same entry/exit with 50% size.",
    }),
  );

  scenarios.push(
    buildScenarioResult({
      trade,
      scenarioId: "LARGER_SIZE_SIM_ONLY",
      label: "Larger size (150%) simulation-only",
      simulated: true,
      entryPrice: trade.entryPrice,
      exitPrice: trade.exitPrice,
      pnlUsd: pnlForMove(trade, trade.entryPrice, trade.exitPrice, 1.5),
      note: "Simulation only — never auto-applied to live risk.",
    }),
  );

  const early = earlierExit(path);
  scenarios.push(
    buildScenarioResult({
      trade,
      scenarioId: "EARLIER_EXIT",
      label: "Earlier exit",
      simulated: true,
      entryPrice: trade.entryPrice,
      exitPrice: early.exitPrice,
      pnlUsd: pnlForMove(trade, trade.entryPrice, early.exitPrice),
      note: early.note,
    }),
  );

  const trailing = trailingStopExit(trade, path);
  scenarios.push(
    buildScenarioResult({
      trade,
      scenarioId: "TRAILING_STOP",
      label: "Trailing stop",
      simulated: true,
      entryPrice: trade.entryPrice,
      exitPrice: trailing.exitPrice,
      pnlUsd: pnlForMove(trade, trade.entryPrice, trailing.exitPrice),
      note: trailing.note,
    }),
  );

  const fixedStop = fixedStopExit(trade, path);
  scenarios.push(
    buildScenarioResult({
      trade,
      scenarioId: "FIXED_STOP_LOSS",
      label: "Fixed stop loss",
      simulated: true,
      entryPrice: trade.entryPrice,
      exitPrice: fixedStop.exitPrice,
      pnlUsd: pnlForMove(trade, trade.entryPrice, fixedStop.exitPrice),
      note: fixedStop.note,
    }),
  );

  const tp1 = takeProfitExit(trade, path, 1);
  scenarios.push(
    buildScenarioResult({
      trade,
      scenarioId: "TAKE_PROFIT_1R",
      label: "Take profit at 1R",
      simulated: true,
      entryPrice: trade.entryPrice,
      exitPrice: tp1.exitPrice,
      pnlUsd: pnlForMove(trade, trade.entryPrice, tp1.exitPrice),
      note: tp1.note,
    }),
  );

  const tp2 = takeProfitExit(trade, path, 2);
  scenarios.push(
    buildScenarioResult({
      trade,
      scenarioId: "TAKE_PROFIT_2R",
      label: "Take profit at 2R",
      simulated: true,
      entryPrice: trade.entryPrice,
      exitPrice: tp2.exitPrice,
      pnlUsd: pnlForMove(trade, trade.entryPrice, tp2.exitPrice),
      note: tp2.note,
    }),
  );

  scenarios.push(
    buildScenarioResult({
      trade,
      scenarioId: "NO_TRADE",
      label: "No trade scenario",
      simulated: true,
      entryPrice: trade.entryPrice,
      exitPrice: trade.entryPrice,
      pnlUsd: 0,
      note: "Skipped trade entirely.",
    }),
  );

  const wait = waitForConfirmationExit(trade, path);
  scenarios.push(
    buildScenarioResult({
      trade,
      scenarioId: "WAIT_FOR_CONFIRMATION",
      label: "Wait for confirmation",
      simulated: true,
      entryPrice: wait.entryPrice,
      exitPrice: wait.exitPrice,
      pnlUsd: pnlForMove(trade, wait.entryPrice, wait.exitPrice),
      note: wait.note,
    }),
  );

  const best = scenarios.reduce((acc, next) => (next.pnlUsd > acc.pnlUsd ? next : acc));
  const avoidedLoss = Number(Math.max(0, -actual.pnlUsd).toFixed(4));
  const missedProfit = Number(Math.max(0, best.pnlUsd - actual.pnlUsd).toFixed(4));
  const confidence = confidenceScore({
    pathLength: path.length,
    actual,
    best,
  });

  const updatedScenarios = scenarios.map((scenario) => ({
    ...scenario,
    avoidedLoss:
      actual.pnlUsd < 0
        ? Number(Math.max(0, scenario.pnlUsd - actual.pnlUsd).toFixed(4))
        : 0,
    missedProfit: Number(Math.max(0, best.pnlUsd - scenario.pnlUsd).toFixed(4)),
  }));

  return {
    trade: { ...trade, marketPricePath: path },
    actualResult: {
      ...actual,
      avoidedLoss,
      missedProfit,
    },
    simulatedResults: updatedScenarios,
    avoidedLoss,
    missedProfit,
    recommendedRuleChange: recommendedRuleChange(actual, scenarios),
    confidence,
    riskNote:
      "Simulation only — cannot alter historical records and cannot increase live risk automatically.",
  };
}
