import { classifyTradeResult } from "./trade-result-classifier";
import type {
  PnlCalculationInput,
  PnlCalculationResult,
  PnlInput,
  PnlPendingDataReason,
  PnlValidationResult,
  PositionSide,
} from "./pnl-types";

export function buySellToPositionSide(side: "BUY" | "SELL"): PositionSide {
  return side === "BUY" ? "LONG" : "SHORT";
}

export function positionSideToBuySell(side: PositionSide): "BUY" | "SELL" {
  return side === "LONG" ? "BUY" : "SELL";
}

export function validatePnlInput(input: PnlInput): PnlValidationResult {
  const reasons: PnlPendingDataReason[] = [];
  const warnings: string[] = [];

  if (!input.tradeId?.trim()) reasons.push("MISSING_TRADE_ID");
  if (!input.positionId?.trim()) reasons.push("MISSING_POSITION_ID");
  if (input.environment === "LIVE") reasons.push("LIVE_ENV_BLOCKED");

  const qty = Math.abs(Number.parseFloat(input.qty));
  if (!Number.isFinite(qty) || qty <= 0) reasons.push("ZERO_QTY");

  if (input.entryPrice == null || !Number.isFinite(input.entryPrice) || input.entryPrice <= 0) {
    reasons.push("MISSING_ENTRY_PRICE");
  }
  if (input.exitPrice == null || !Number.isFinite(input.exitPrice) || input.exitPrice <= 0) {
    reasons.push("MISSING_EXIT_PRICE");
  }
  if (input.side !== "LONG" && input.side !== "SHORT") reasons.push("INVALID_SIDE");
  if (!input.closedAt) reasons.push("MISSING_CLOSE_EVENT");

  const hasCloseFill =
    input.exitPrice != null && Number.isFinite(input.exitPrice) && input.exitPrice > 0;
  const hasEntryFill =
    input.entryPrice != null && Number.isFinite(input.entryPrice) && input.entryPrice > 0;
  if (!hasCloseFill || !hasEntryFill) {
    if (!reasons.includes("MISSING_ENTRY_PRICE") && !hasEntryFill) reasons.push("MISSING_FILL_DATA");
    if (!reasons.includes("MISSING_EXIT_PRICE") && !hasCloseFill) reasons.push("MISSING_FILL_DATA");
  }

  if (input.openedAt && input.closedAt && input.closedAt < input.openedAt) {
    reasons.push("INVALID_TIMestamps");
  }

  if (input.entryFee === 0 && input.exitFee === 0) {
    warnings.push("Fees assumed 0 — no fill fee data in journal.");
  }

  return { valid: reasons.length === 0, reasons: [...new Set(reasons)], warnings };
}

export function calculatePnlFromInput(input: PnlInput): PnlCalculationResult {
  const validation = validatePnlInput(input);
  if (!validation.valid) {
    return {
      ok: false,
      status: "PENDING_DATA",
      grossPnl: null,
      entryFee: input.entryFee,
      exitFee: input.exitFee,
      netPnl: null,
      pnlPct: null,
      result: null,
      reasons: validation.reasons,
      warnings: validation.warnings,
      message: `PnL pending — ${validation.reasons.join(", ")}.`,
    };
  }

  const qty = Math.abs(Number.parseFloat(input.qty));
  const entry = input.entryPrice!;
  const exit = input.exitPrice!;
  const grossPnl =
    input.side === "LONG" ? (exit - entry) * qty : (entry - exit) * qty;
  const entryFee = input.entryFee;
  const exitFee = input.exitFee;
  const netPnl = grossPnl - entryFee - exitFee;
  const notional = entry * qty;
  const pnlPct = notional > 0 ? (netPnl / notional) * 100 : 0;
  const result = classifyTradeResult(netPnl);

  return {
    ok: true,
    status: "REALIZED",
    grossPnl: Number(grossPnl.toFixed(6)),
    entryFee,
    exitFee,
    netPnl: Number(netPnl.toFixed(6)),
    pnlPct: Number(pnlPct.toFixed(4)),
    result,
    reasons: [],
    warnings: validation.warnings,
    message: `PnL calculated — ${result}.`,
  };
}

/** Legacy wrapper — maps BUY/SELL input to PnlInput. */
export function calculateRealizedPnl(input: PnlCalculationInput): PnlCalculationResult {
  return calculatePnlFromInput({
    tradeId: input.tradeId,
    positionId: input.tradeId,
    symbol: input.symbol,
    side: buySellToPositionSide(input.side),
    qty: input.qty,
    entryPrice: input.entryPrice,
    exitPrice: input.exitPrice,
    entryFee: input.feeEstimate != null ? input.feeEstimate / 2 : 0,
    exitFee: input.feeEstimate != null ? input.feeEstimate / 2 : 0,
    openedAt: null,
    closedAt: new Date().toISOString(),
    environment: "TESTNET",
  });
}
