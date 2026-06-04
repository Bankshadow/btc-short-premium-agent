import type { PaperOrder, PaperPortfolioSummary, PaperTradingSettings } from "./paper-order-types";
import {
  DEFAULT_PAPER_SETTINGS,
  PAPER_ORDERS_STORAGE_KEY,
  PAPER_SETTINGS_STORAGE_KEY,
} from "./paper-order-types";
import { computeUnrealizedPnlPct } from "./paper-pnl-engine";

const MAX_ORDERS = 200;

export function loadPaperSettings(): PaperTradingSettings {
  if (typeof window === "undefined") return DEFAULT_PAPER_SETTINGS;
  try {
    const raw = localStorage.getItem(PAPER_SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_PAPER_SETTINGS;
    return { ...DEFAULT_PAPER_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_PAPER_SETTINGS;
  }
}

export function savePaperSettings(settings: PaperTradingSettings): PaperTradingSettings {
  if (typeof window === "undefined") return settings;
  localStorage.setItem(PAPER_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  return settings;
}

function normalizeOrder(raw: Record<string, unknown>): PaperOrder | null {
  if (!raw.id || !raw.decisionLogId) return null;
  return {
    id: String(raw.id),
    decisionLogId: String(raw.decisionLogId),
    committeeVerdict: (raw.committeeVerdict as PaperOrder["committeeVerdict"]) ?? "WAIT",
    instrument: (raw.instrument as PaperOrder["instrument"]) ?? "no_trade",
    symbol: String(raw.symbol ?? "BTC"),
    side: (raw.side as PaperOrder["side"]) ?? "none",
    entryBtcPrice: Number(raw.entryBtcPrice ?? 0),
    entryOptionMark: raw.entryOptionMark != null ? Number(raw.entryOptionMark) : null,
    strike: raw.strike != null ? Number(raw.strike) : null,
    sizePct: Number(raw.sizePct ?? 0),
    notionalUsd: Number(raw.notionalUsd ?? 10_000),
    status: (raw.status as PaperOrder["status"]) ?? "OPEN",
    openedAt: String(raw.openedAt ?? new Date().toISOString()),
    closedAt: raw.closedAt != null ? String(raw.closedAt) : null,
    exitBtcPrice: raw.exitBtcPrice != null ? Number(raw.exitBtcPrice) : null,
    realizedPnlPct: raw.realizedPnlPct != null ? Number(raw.realizedPnlPct) : null,
    unrealizedPnlPct:
      raw.unrealizedPnlPct != null ? Number(raw.unrealizedPnlPct) : null,
    lastMarkAt: raw.lastMarkAt != null ? String(raw.lastMarkAt) : null,
    lastMarkBtcPrice:
      raw.lastMarkBtcPrice != null ? Number(raw.lastMarkBtcPrice) : null,
    openedBy: (raw.openedBy as PaperOrder["openedBy"]) ?? "manual",
    notes: String(raw.notes ?? ""),
    supabaseId: raw.supabaseId != null ? String(raw.supabaseId) : undefined,
  };
}

export function loadPaperOrders(): PaperOrder[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(PAPER_ORDERS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) =>
        typeof item === "object" && item !== null
          ? normalizeOrder(item as Record<string, unknown>)
          : null,
      )
      .filter((o): o is PaperOrder => o != null);
  } catch {
    return [];
  }
}

export function persistPaperOrders(orders: PaperOrder[]): PaperOrder[] {
  if (typeof window === "undefined") return orders;
  const next = orders.slice(0, MAX_ORDERS);
  localStorage.setItem(PAPER_ORDERS_STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function savePaperOrder(order: PaperOrder): PaperOrder[] {
  return persistPaperOrders([order, ...loadPaperOrders()]);
}

export function updatePaperOrder(
  id: string,
  updater: (order: PaperOrder) => PaperOrder,
): PaperOrder[] {
  return persistPaperOrders(
    loadPaperOrders().map((o) => (o.id === id ? updater(o) : o)),
  );
}

export function getOpenPaperOrders(): PaperOrder[] {
  return loadPaperOrders().filter((o) => o.status === "OPEN");
}

export function hasOpenPaperOrder(): boolean {
  return getOpenPaperOrders().length > 0;
}

export function findOrderByLogId(decisionLogId: string): PaperOrder | undefined {
  return loadPaperOrders().find((o) => o.decisionLogId === decisionLogId);
}

export function markOrdersToMarket(btcPrice: number): PaperOrder[] {
  if (btcPrice <= 0) return loadPaperOrders();
  const now = new Date().toISOString();
  return persistPaperOrders(
    loadPaperOrders().map((order) => {
      if (order.status !== "OPEN") return order;
      const unrealized = computeUnrealizedPnlPct(order, btcPrice);
      return {
        ...order,
        unrealizedPnlPct: unrealized,
        lastMarkBtcPrice: btcPrice,
        lastMarkAt: now,
      };
    }),
  );
}

export function summarizePaperPortfolio(
  orders: PaperOrder[],
): PaperPortfolioSummary {
  const closed = orders.filter((o) => o.status === "CLOSED");
  const open = orders.filter((o) => o.status === "OPEN");
  const wins = closed.filter((o) => (o.realizedPnlPct ?? 0) > 0).length;
  const losses = closed.filter((o) => (o.realizedPnlPct ?? 0) < 0).length;

  return {
    openCount: open.length,
    closedCount: closed.length,
    totalRealizedPnlPct: Number(
      closed.reduce((s, o) => s + (o.realizedPnlPct ?? 0), 0).toFixed(2),
    ),
    totalUnrealizedPnlPct: Number(
      open.reduce((s, o) => s + (o.unrealizedPnlPct ?? 0), 0).toFixed(2),
    ),
    winCount: wins,
    lossCount: losses,
  };
}
