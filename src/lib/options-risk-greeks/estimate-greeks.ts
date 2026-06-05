import { parseOptionSymbol } from "@/lib/bybit/option-chain";
import type { OptionCandidate } from "@/lib/types/market";
import type { OptionsInstrument } from "@/lib/options-execution/types";

export interface RawGreekEstimate {
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  iv: number;
  estimable: boolean;
}

export function estimatePositionGreeks(input: {
  delta?: number;
  iv?: number;
  markPrice?: number;
  spotPrice?: number;
  hoursToExpiry?: number;
  contracts?: number;
  side?: "short" | "long";
  candidate?: OptionCandidate | null;
  instrument?: OptionsInstrument | null;
}): RawGreekEstimate {
  const sideSign = input.side === "short" ? -1 : 1;
  const contracts = Math.max(input.contracts ?? 1, 0);
  const rawDelta =
    input.instrument?.delta ??
    input.candidate?.delta ??
    input.delta ??
    0;
  const iv =
    input.instrument?.iv ??
    input.candidate?.impliedVolatility ??
    input.iv ??
    0;
  const mark =
    input.instrument?.markPrice ??
    input.candidate?.markPrice ??
    input.markPrice ??
    0;
  const spot = input.spotPrice ?? 60_000;
  const hours = Math.max(input.hoursToExpiry ?? 48, 0.5);
  const tYears = hours / (24 * 365);

  const estimable = rawDelta !== 0 || iv > 0 || mark > 0;

  const thetaFromCandidate = input.candidate?.theta;
  const thetaPerContract =
    thetaFromCandidate != null && thetaFromCandidate !== 0
      ? thetaFromCandidate
      : -(mark / hours) * 0.15;

  const gammaPerContract =
    spot > 0 ? (Math.abs(rawDelta) * iv * 0.001) / spot : 0;

  const vegaPerContract =
    mark > 0 && tYears > 0 ? mark * Math.sqrt(tYears) * 0.08 : 0;

  return {
    delta: Number((rawDelta * sideSign * contracts).toFixed(4)),
    gamma: Number((gammaPerContract * sideSign * contracts).toFixed(6)),
    theta: Number((thetaPerContract * sideSign * contracts).toFixed(4)),
    vega: Number((vegaPerContract * sideSign * contracts).toFixed(4)),
    iv: Number(iv.toFixed(2)),
    estimable,
  };
}

export function estimateBreakeven(input: {
  strike: number;
  premium: number;
  instrument: "sell_call" | "sell_put" | "call" | "put" | "unknown";
}): number | null {
  if (input.instrument === "sell_call" || input.instrument === "call") {
    return input.strike + input.premium;
  }
  if (input.instrument === "sell_put" || input.instrument === "put") {
    return input.strike - input.premium;
  }
  return null;
}

export function estimateMaxLoss(input: {
  premiumUsd: number;
  contracts: number;
  spotPrice: number;
  instrument: "sell_call" | "sell_put" | "call" | "put" | "unknown";
}): number {
  const tail =
    input.instrument === "sell_put"
      ? input.spotPrice * 0.15 * input.contracts
      : input.spotPrice * 0.05 * input.contracts;
  return Number((input.premiumUsd * 3 + tail).toFixed(2));
}

export function parsePositionMeta(symbol: string): {
  strike: number;
  expiry: string;
  expiryTimeMs: number | null;
  optionType: "call" | "put" | "unknown";
} {
  const parsed = parseOptionSymbol(symbol);
  if (!parsed) {
    return { strike: 0, expiry: "unknown", expiryTimeMs: null, optionType: "unknown" };
  }
  return {
    strike: parsed.strike,
    expiry: parsed.expiry,
    expiryTimeMs: parsed.expiryTime,
    optionType: parsed.side === "CALL" ? "call" : "put",
  };
}
