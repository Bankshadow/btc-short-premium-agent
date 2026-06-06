import type { QuantFrictionAssumptions } from "./types";

export const DEFAULT_QUANT_FRICTION: QuantFrictionAssumptions = {
  feeBps: 4,
  slippageBps: 3,
  spreadBps: 2,
};

/** Round-trip friction cost in percent (entry + exit). */
export function roundTripFrictionPct(friction: QuantFrictionAssumptions): number {
  const perSideBps = friction.feeBps + friction.slippageBps + friction.spreadBps;
  return Number(((perSideBps * 2) / 100).toFixed(4));
}

export function applyEntryFriction(
  price: number,
  direction: "LONG" | "SHORT",
  friction: QuantFrictionAssumptions,
): number {
  const bps = friction.feeBps + friction.slippageBps + friction.spreadBps;
  const mult = bps / 10_000;
  return direction === "LONG" ? price * (1 + mult) : price * (1 - mult);
}

export function applyExitFriction(
  price: number,
  direction: "LONG" | "SHORT",
  friction: QuantFrictionAssumptions,
): number {
  const bps = friction.feeBps + friction.slippageBps;
  const mult = bps / 10_000;
  return direction === "LONG" ? price * (1 - mult) : price * (1 + mult);
}

export function totalFrictionApplied(
  tradeCount: number,
  friction: QuantFrictionAssumptions,
): number {
  return Number((tradeCount * roundTripFrictionPct(friction)).toFixed(2));
}
