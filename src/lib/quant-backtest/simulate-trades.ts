import { atr, type Candle } from "@/lib/indicators/technical";
import { applyEntryFriction, applyExitFriction } from "./friction";
import { detectBarRegime } from "./signal-runners";
import type {
  QuantBacktestTrade,
  QuantFrictionAssumptions,
  QuantSignalDirection,
  QuantStrategyParameters,
} from "./types";
import type { SignalSeries } from "./signal-runners";

function grossPnlPct(
  direction: "LONG" | "SHORT",
  entry: number,
  exit: number,
): number {
  const raw =
    direction === "LONG"
      ? ((exit - entry) / entry) * 100
      : ((entry - exit) / entry) * 100;
  return Number(raw.toFixed(4));
}

export function simulateQuantTrades(input: {
  candles: Candle[];
  signals: SignalSeries;
  friction: QuantFrictionAssumptions;
  parameters?: QuantStrategyParameters;
}): QuantBacktestTrade[] {
  const { candles, signals, friction, parameters } = input;
  const trades: QuantBacktestTrade[] = [];
  const stopMult = parameters?.stopLossAtrMult ?? 2;
  let position: {
    direction: "LONG" | "SHORT";
    entryIndex: number;
    entryPrice: number;
    regime: "bullish" | "bearish" | "neutral";
  } | null = null;

  const closePosition = (exitIndex: number, exitPrice: number) => {
    if (!position) return;
    const direction = position.direction;
    const adjEntry = applyEntryFriction(position.entryPrice, direction, friction);
    const adjExit = applyExitFriction(exitPrice, direction, friction);
    const gross = grossPnlPct(direction, position.entryPrice, exitPrice);
    const net = grossPnlPct(direction, adjEntry, adjExit);
    const frictionCost = Number((gross - net).toFixed(4));
    trades.push({
      id: `qbt-${trades.length + 1}`,
      direction,
      entryTime: new Date(candles[position.entryIndex].timestamp).toISOString(),
      exitTime: new Date(candles[exitIndex].timestamp).toISOString(),
      entryPrice: Number(position.entryPrice.toFixed(2)),
      exitPrice: Number(exitPrice.toFixed(2)),
      grossPnlPct: gross,
      netPnlPct: net,
      frictionCostPct: frictionCost,
      regime: position.regime,
      barsHeld: exitIndex - position.entryIndex,
    });
    position = null;
  };

  for (let i = 1; i < candles.length; i += 1) {
    const bar = candles[i];
    const signal = signals[i];

    if (position) {
      const atrVal = atr(candles.slice(0, i + 1), 14);
      const stopDist = atrVal ? atrVal * stopMult : null;
      let stopHit = false;
      if (stopDist) {
        if (position.direction === "LONG" && bar.low <= position.entryPrice - stopDist) {
          closePosition(i, position.entryPrice - stopDist);
          stopHit = true;
        } else if (position.direction === "SHORT" && bar.high >= position.entryPrice + stopDist) {
          closePosition(i, position.entryPrice + stopDist);
          stopHit = true;
        }
      }
      if (stopHit) continue;

      const opposite =
        (position.direction === "LONG" && signal === "SHORT") ||
        (position.direction === "SHORT" && signal === "LONG");
      if (opposite || signal === "FLAT") {
        closePosition(i, bar.close);
      }
    }

    if (!position && (signal === "LONG" || signal === "SHORT")) {
      position = {
        direction: signal,
        entryIndex: i,
        entryPrice: bar.close,
        regime: detectBarRegime(candles, i),
      };
    }
  }

  if (position) {
    closePosition(candles.length - 1, candles[candles.length - 1].close);
  }

  return trades;
}
