import type { BinancePosition } from "@/lib/execution/binance-testnet-types";
import type { OpenTrade } from "@/lib/trades/trade-types";
import {
  type PositionSnapshot,
  type ReconciliationIssue,
  type ReconciliationResult,
  POSITION_REFRESH_STALE_MS,
  positionSideFromAmt,
  tradeSideToPositionSide,
} from "./position-types";

export function getMaxOpenPositions(): number {
  const raw = process.env.BINANCE_TESTNET_MAX_OPEN_POSITIONS?.trim();
  const n = raw ? Number.parseInt(raw, 10) : 1;
  return Number.isFinite(n) && n > 0 ? n : 1;
}

export function filterNonZeroBinancePositions(
  positions: BinancePosition[],
): BinancePosition[] {
  return positions.filter((p) => Math.abs(Number.parseFloat(p.positionAmt)) > 1e-8);
}

export function qtyMatches(localQty: string, remoteQty: string, tolerance = 0.001): boolean {
  const local = Math.abs(Number.parseFloat(localQty));
  const remote = Math.abs(Number.parseFloat(remoteQty));
  if (!Number.isFinite(local) || !Number.isFinite(remote)) return false;
  if (remote === 0) return local === 0;
  return Math.abs(local - remote) <= tolerance || Math.abs(local - remote) / remote < 0.02;
}

function findBinancePositionForTrade(
  trade: OpenTrade,
  positions: BinancePosition[],
): BinancePosition | null {
  const expectedSide = tradeSideToPositionSide(trade.side);
  for (const pos of positions) {
    if (pos.symbol.toUpperCase() !== trade.symbol.toUpperCase()) continue;
    const side = positionSideFromAmt(Number.parseFloat(pos.positionAmt));
    if (side !== expectedSide) continue;
    if (qtyMatches(trade.qty, pos.positionAmt)) return pos;
  }
  for (const pos of positions) {
    if (pos.symbol.toUpperCase() === trade.symbol.toUpperCase()) return pos;
  }
  return null;
}

export function reconcilePositions(input: {
  openTrades: OpenTrade[];
  binancePositions: BinancePosition[];
  snapshots: PositionSnapshot[];
  lastMonitoredAt: string | null;
  maxOpenPositions?: number;
  binanceConnected: boolean;
  now?: number;
}): ReconciliationResult {
  const now = input.now ?? Date.now();
  const maxOpenPositions = input.maxOpenPositions ?? getMaxOpenPositions();
  const nonZero = filterNonZeroBinancePositions(input.binancePositions);
  const issues: ReconciliationIssue[] = [];

  if (!input.binanceConnected) {
    issues.push({
      code: "BINANCE_NOT_CONNECTED",
      severity: "BLOCKED",
      message: "Binance testnet is not connected — position state unknown.",
    });
  }

  if (input.openTrades.length > maxOpenPositions) {
    issues.push({
      code: "MAX_OPEN_POSITIONS_EXCEEDED",
      severity: "BLOCKED",
      message: `Multiple open positions (${input.openTrades.length}) exceed max ${maxOpenPositions}.`,
    });
  }

  if (nonZero.length > maxOpenPositions) {
    issues.push({
      code: "BINANCE_MAX_POSITIONS_EXCEEDED",
      severity: "BLOCKED",
      message: `Binance has ${nonZero.length} open positions — exceeds max ${maxOpenPositions}.`,
    });
  }

  if (input.lastMonitoredAt) {
    const age = now - Date.parse(input.lastMonitoredAt);
    if (age > POSITION_REFRESH_STALE_MS) {
      issues.push({
        code: "STALE_POSITION_REFRESH",
        severity: "WARNING",
        message: "Position refresh is stale — refresh positions before close.",
      });
    }
  } else if (input.openTrades.length > 0 && input.binanceConnected) {
    issues.push({
      code: "NEVER_MONITORED",
      severity: "WARNING",
      message: "Open trade exists but position has never been monitored.",
    });
  }

  const matchedBinance = new Set<string>();

  for (const trade of input.openTrades) {
    const binancePos = findBinancePositionForTrade(trade, nonZero);
    const snapshot = input.snapshots.find((s) => s.tradeId === trade.tradeId);

    if (!binancePos) {
      issues.push({
        code: "LOCAL_TRADE_MISSING_BINANCE_POSITION",
        severity: "WARNING",
        message: `Local OPEN trade ${trade.tradeId} has no matching Binance position.`,
      });
      continue;
    }

    matchedBinance.add(binancePos.symbol);

    const expectedSide = tradeSideToPositionSide(trade.side);
    const binanceSide = positionSideFromAmt(Number.parseFloat(binancePos.positionAmt));
    if (binanceSide && binanceSide !== expectedSide) {
      issues.push({
        code: "SIDE_MISMATCH",
        severity: "WARNING",
        message: `Side mismatch for ${trade.symbol}: local ${expectedSide}, Binance ${binanceSide}.`,
      });
    }

    if (!qtyMatches(trade.qty, binancePos.positionAmt)) {
      issues.push({
        code: "QTY_MISMATCH",
        severity: "WARNING",
        message: `Qty mismatch for ${trade.symbol}: local ${trade.qty}, Binance ${binancePos.positionAmt}.`,
      });
    }

    if (snapshot?.status === "UNKNOWN") {
      issues.push({
        code: "POSITION_STATE_UNKNOWN",
        severity: "BLOCKED",
        message: `Position state unknown for trade ${trade.tradeId}.`,
      });
    }
  }

  for (const pos of nonZero) {
    if (matchedBinance.has(pos.symbol)) continue;
    const hasLocal = input.openTrades.some(
      (t) => t.symbol.toUpperCase() === pos.symbol.toUpperCase(),
    );
    if (!hasLocal) {
      issues.push({
        code: "BINANCE_POSITION_MISSING_LOCAL_TRADE",
        severity: "WARNING",
        message: `Binance position on ${pos.symbol} has no matching local OPEN trade.`,
      });
    }
  }

  const hasBlocked = issues.some((i) => i.severity === "BLOCKED");
  const hasWarning = issues.some((i) => i.severity === "WARNING");

  return {
    status: hasBlocked ? "BLOCKED" : hasWarning ? "WARNING" : "OK",
    issues,
    openTradeCount: input.openTrades.length,
    binancePositionCount: nonZero.length,
    lastMonitoredAt: input.lastMonitoredAt,
  };
}

export function isReconciliationBlocking(status: ReconciliationResult): boolean {
  return status.status === "BLOCKED";
}
