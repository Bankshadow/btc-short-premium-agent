import { classifyTradeResult } from "./trade-result-classifier";
import type { PnlCalculationInput, PnlCalculationResult } from "./pnl-types";

const DEFAULT_FEE_RATE = 0.0004;

export function estimateFee(notional: number, feeRate = DEFAULT_FEE_RATE): number {
  return Number((Math.abs(notional) * feeRate).toFixed(6));
}

export function calculateRealizedPnl(input: PnlCalculationInput): PnlCalculationResult {
  if (input.entryPrice == null || !Number.isFinite(input.entryPrice)) {
    return {
      ok: false,
      status: "PNL_PENDING_DATA",
      grossPnl: null,
      feeEstimate: 0,
      netPnl: null,
      pnlPct: null,
      result: null,
      message: "Missing entry price — PnL pending data.",
    };
  }

  if (input.exitPrice == null || !Number.isFinite(input.exitPrice)) {
    return {
      ok: false,
      status: "PNL_PENDING_DATA",
      grossPnl: null,
      feeEstimate: 0,
      netPnl: null,
      pnlPct: null,
      result: null,
      message: "Missing exit price — PnL pending data.",
    };
  }

  const qty = Math.abs(Number.parseFloat(input.qty));
  if (!Number.isFinite(qty) || qty <= 0) {
    return {
      ok: false,
      status: "PNL_PENDING_DATA",
      grossPnl: null,
      feeEstimate: 0,
      netPnl: null,
      pnlPct: null,
      result: null,
      message: "Invalid quantity — PnL pending data.",
    };
  }

  const entry = input.entryPrice;
  const exit = input.exitPrice;
  const grossPnl =
    input.side === "BUY"
      ? (exit - entry) * qty
      : (entry - exit) * qty;

  const notional = entry * qty;
  const feeEstimate = input.feeEstimate ?? estimateFee(notional + exit * qty);
  const netPnl = grossPnl - feeEstimate;
  const pnlPct = notional > 0 ? (netPnl / notional) * 100 : 0;
  const result = classifyTradeResult(netPnl);

  return {
    ok: true,
    status: "REALIZED",
    grossPnl: Number(grossPnl.toFixed(6)),
    feeEstimate: Number(feeEstimate.toFixed(6)),
    netPnl: Number(netPnl.toFixed(6)),
    pnlPct: Number(pnlPct.toFixed(4)),
    result,
    message: `PnL calculated — ${result}.`,
  };
}
