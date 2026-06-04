import type { PerpAssetId } from "./asset-config";
import type {
  PerpDirectionalSignal,
  PerpPaperPosition,
} from "./types";

export const PERP_PAPER_STORAGE_KEY = "btc-desk:perp-paper-positions";
export const PERP_PAPER_NOTIONAL_USD = 10_000;
const MAX_POSITIONS = 200;

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

export function loadPerpPositions(): PerpPaperPosition[] {
  if (!isBrowser()) return [];
  try {
    const raw = localStorage.getItem(PERP_PAPER_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is PerpPaperPosition =>
        typeof item === "object" && item !== null && "id" in item,
    );
  } catch {
    return [];
  }
}

function persist(positions: PerpPaperPosition[]): PerpPaperPosition[] {
  if (!isBrowser()) return positions;
  const trimmed = positions.slice(-MAX_POSITIONS);
  localStorage.setItem(PERP_PAPER_STORAGE_KEY, JSON.stringify(trimmed));
  return trimmed;
}

export function getOpenPerpPositions(): PerpPaperPosition[] {
  return loadPerpPositions().filter((p) => p.status === "OPEN");
}

export function hasOpenPositionFor(assetId: PerpAssetId): boolean {
  return getOpenPerpPositions().some((p) => p.assetId === assetId);
}

function pnlPct(position: PerpPaperPosition, mark: number): number {
  if (position.entryPrice <= 0) return 0;
  const raw = (mark - position.entryPrice) / position.entryPrice;
  const directional = position.direction === "LONG" ? raw : -raw;
  return Number((directional * 100).toFixed(2));
}

/**
 * Opens a simulated paper position from an actionable directional signal.
 * Paper-first: no live order is ever placed. Returns null when not actionable,
 * the signal is FLAT, or an open position already exists for the asset.
 */
export function openPerpPositionFromSignal(
  signal: PerpDirectionalSignal,
  openedBy: PerpPaperPosition["openedBy"] = "scanner_auto",
): PerpPaperPosition | null {
  if (signal.direction === "FLAT" || !signal.actionable) return null;
  if (hasOpenPositionFor(signal.assetId)) return null;

  const now = new Date().toISOString();
  const sizePct = signal.suggestedSizePct > 0 ? signal.suggestedSizePct : 1;

  const position: PerpPaperPosition = {
    id: `perp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    assetId: signal.assetId,
    symbol: signal.symbol,
    label: signal.label,
    direction: signal.direction,
    entryPrice: signal.price,
    sizePct,
    notionalUsd: Number((PERP_PAPER_NOTIONAL_USD * (sizePct / 100)).toFixed(2)),
    stopLoss: signal.stopLoss,
    takeProfit: signal.takeProfit,
    confidence: signal.confidence,
    status: "OPEN",
    openedAt: now,
    openedBy,
    reason: signal.reasons.join("; "),
    lastMarkPrice: signal.price,
    lastMarkAt: now,
    unrealizedPnlPct: 0,
    closedAt: null,
    exitPrice: null,
    realizedPnlPct: null,
  };

  const positions = loadPerpPositions();
  positions.push(position);
  persist(positions);
  return position;
}

/** Opens paper positions for every actionable signal in a scan. */
export function autoOpenFromScan(
  signals: PerpDirectionalSignal[],
): PerpPaperPosition[] {
  const opened: PerpPaperPosition[] = [];
  for (const signal of signals) {
    const position = openPerpPositionFromSignal(signal);
    if (position) opened.push(position);
  }
  return opened;
}

/** Marks open positions to the latest scan prices and computes unrealized PnL. */
export function markPerpPositions(
  signals: PerpDirectionalSignal[],
): PerpPaperPosition[] {
  const priceBySymbol = new Map(
    signals.filter((s) => s.price > 0).map((s) => [s.symbol, s.price]),
  );
  const now = new Date().toISOString();

  const positions = loadPerpPositions().map((position) => {
    if (position.status !== "OPEN") return position;
    const mark = priceBySymbol.get(position.symbol);
    if (mark === undefined) return position;
    return {
      ...position,
      lastMarkPrice: mark,
      lastMarkAt: now,
      unrealizedPnlPct: pnlPct(position, mark),
    };
  });

  return persist(positions);
}

export function closePerpPosition(
  id: string,
  exitPrice: number,
): PerpPaperPosition | null {
  const positions = loadPerpPositions();
  const index = positions.findIndex((p) => p.id === id);
  if (index < 0) return null;

  const position = positions[index];
  if (position.status === "CLOSED") return position;

  const closed: PerpPaperPosition = {
    ...position,
    status: "CLOSED",
    closedAt: new Date().toISOString(),
    exitPrice,
    realizedPnlPct: pnlPct(position, exitPrice),
    lastMarkPrice: exitPrice,
    unrealizedPnlPct: 0,
  };

  positions[index] = closed;
  persist(positions);
  return closed;
}

export interface PerpPortfolioSummary {
  openCount: number;
  closedCount: number;
  totalUnrealizedPct: number;
  totalRealizedPct: number;
  winRatePct: number;
}

export function summarizePerpPortfolio(): PerpPortfolioSummary {
  const positions = loadPerpPositions();
  const open = positions.filter((p) => p.status === "OPEN");
  const closed = positions.filter((p) => p.status === "CLOSED");
  const wins = closed.filter((p) => (p.realizedPnlPct ?? 0) > 0).length;

  return {
    openCount: open.length,
    closedCount: closed.length,
    totalUnrealizedPct: Number(
      open.reduce((acc, p) => acc + (p.unrealizedPnlPct ?? 0), 0).toFixed(2),
    ),
    totalRealizedPct: Number(
      closed.reduce((acc, p) => acc + (p.realizedPnlPct ?? 0), 0).toFixed(2),
    ),
    winRatePct: closed.length > 0
      ? Number(((wins / closed.length) * 100).toFixed(1))
      : 0,
  };
}
