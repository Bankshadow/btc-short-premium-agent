import type { BinanceTestnetClient } from "@/lib/execution/binance-testnet-client";
import { createBinanceTestnetClient } from "@/lib/execution/binance-testnet-client";
import { isBinanceConnected } from "@/lib/execution/binance-testnet-status";
import type { BinancePosition, BinanceTestnetStatus } from "@/lib/execution/binance-testnet-types";
import { resolveTestnetConnectionStatus } from "@/lib/execution/testnet-status";
import { appendEvent, getEvents } from "@/lib/journal/journal-query";
import type { JournalEvent } from "@/lib/journal/journal-types";
import { newPositionId } from "@/lib/journal/journal-types";
import { buildMissionSnapshot } from "@/lib/mission/mission-snapshot";
import { calculatePnlForTrade } from "@/lib/pnl/calculate-pnl";
import { buildOpenTradesFromEvents } from "@/lib/trades/trade-store";
import type { OpenTrade } from "@/lib/trades/trade-types";
import {
  filterNonZeroBinancePositions,
  getMaxOpenPositions,
  reconcilePositions,
} from "./position-reconcile";
import type {
  OpenPositionsResponse,
  PositionSnapshot,
  ReconciliationResult,
} from "./position-types";
import {
  positionSideFromAmt,
  tradeSideToPositionSide,
} from "./position-types";

import {
  getLatestMonitoredAt,
  getLatestMonitoredSnapshots,
  snapshotFromMonitoredEvent,
} from "./position-snapshots-from-events";

export {
  getLatestMonitoredAt,
  getLatestMonitoredSnapshots,
  snapshotFromMonitoredEvent,
} from "./position-snapshots-from-events";

function buildSnapshotFromSources(input: {
  trade: OpenTrade;
  positionId: string;
  binancePos: BinancePosition | null;
  refreshedAt: string;
  connected: boolean;
}): PositionSnapshot {
  const expectedSide = tradeSideToPositionSide(input.trade.side);
  const amt = input.binancePos
    ? Number.parseFloat(input.binancePos.positionAmt)
    : Number.parseFloat(input.trade.qty);
  const side = input.binancePos
    ? positionSideFromAmt(amt) ?? expectedSide
    : expectedSide;
  const qty = input.binancePos
    ? String(Math.abs(Number.parseFloat(input.binancePos.positionAmt)))
    : input.trade.qty;
  const entryPrice = input.binancePos
    ? Number.parseFloat(input.binancePos.entryPrice) || input.trade.entryPrice
    : input.trade.entryPrice;
  const markPrice = input.binancePos?.markPrice
    ? Number.parseFloat(input.binancePos.markPrice)
    : null;
  const unrealizedPnl = input.binancePos
    ? Number.parseFloat(input.binancePos.unrealizedProfit)
    : null;
  const notionalUsd =
    markPrice != null && qty
      ? Number((Math.abs(Number.parseFloat(qty)) * markPrice).toFixed(4))
      : input.trade.notionalUsd;
  const unrealizedPnlPct =
    entryPrice && entryPrice > 0 && unrealizedPnl != null && qty
      ? Number(((unrealizedPnl / (Math.abs(Number.parseFloat(qty)) * entryPrice)) * 100).toFixed(4))
      : null;
  const leverage = input.binancePos?.leverage
    ? Number.parseFloat(input.binancePos.leverage)
    : null;

  let status: PositionSnapshot["status"] = "UNKNOWN";
  if (!input.connected) {
    status = "UNKNOWN";
  } else if (input.binancePos && Math.abs(Number.parseFloat(input.binancePos.positionAmt)) > 1e-8) {
    status = "OPEN";
  } else if (input.connected && !input.binancePos) {
    status = "FLAT";
  } else {
    status = "FLAT";
  }

  return {
    positionId: input.positionId,
    tradeId: input.trade.tradeId,
    previewId: input.trade.previewId,
    runId: input.trade.runId,
    decisionLogId: input.trade.decisionLogId,
    environment: "TESTNET",
    symbol: input.trade.symbol,
    side,
    qty,
    entryPrice: entryPrice ?? null,
    markPrice,
    notionalUsd,
    unrealizedPnl,
    unrealizedPnlPct,
    leverage,
    source: "BINANCE_TESTNET",
    refreshedAt: input.refreshedAt,
    status,
  };
}

function findBinanceForTrade(
  trade: OpenTrade,
  positions: BinancePosition[],
): BinancePosition | null {
  const expectedSide = tradeSideToPositionSide(trade.side);
  for (const pos of positions) {
    if (pos.symbol.toUpperCase() !== trade.symbol.toUpperCase()) continue;
    const side = positionSideFromAmt(Number.parseFloat(pos.positionAmt));
    if (side === expectedSide) return pos;
  }
  return (
    positions.find((p) => p.symbol.toUpperCase() === trade.symbol.toUpperCase()) ?? null
  );
}

function resolvePositionId(
  tradeId: string,
  existing: Map<string, PositionSnapshot>,
): string {
  return existing.get(tradeId)?.positionId ?? newPositionId();
}

const ORPHAN_RECONCILE_GRACE_MS = 2 * 60 * 1000;

async function reconcileOrphanFlatTrades(
  openTrades: OpenTrade[],
  snapshots: PositionSnapshot[],
  binancePositions: BinancePosition[],
): Promise<void> {
  const nonZero = filterNonZeroBinancePositions(binancePositions);
  const events = await getEvents();
  const closedIds = new Set(
    events.filter((e) => e.type === "POSITION_CLOSED").map((e) => e.tradeId).filter(Boolean),
  );
  const now = Date.now();

  for (const trade of openTrades) {
    if (closedIds.has(trade.tradeId)) continue;
    const hasRealCloseOrder = events.some(
      (e) =>
        e.tradeId === trade.tradeId &&
        e.type === "CLOSE_ORDER_EXECUTED" &&
        (e.payload as { source?: string }).source === "BINANCE_TESTNET",
    );
    if (hasRealCloseOrder) continue;
    const openedAge = now - Date.parse(trade.openedAt);
    if (openedAge < ORPHAN_RECONCILE_GRACE_MS) continue;
    if (findBinanceForTrade(trade, nonZero)) continue;
    const snapshot = snapshots.find((s) => s.tradeId === trade.tradeId);
    if (snapshot?.status !== "FLAT") continue;

    const entryPrice = trade.entryPrice ?? 0;
    const qty = trade.qty;
    const sideToClose = trade.side === "SELL" ? "BUY" : "SELL";
    const reconcileOrderId = `reconcile-${trade.tradeId}`;

    await appendEvent({
      type: "CLOSE_ORDER_EXECUTED",
      environment: "testnet",
      runId: trade.runId,
      decisionLogId: trade.decisionLogId,
      tradeId: trade.tradeId,
      previewId: trade.previewId,
      positionId: snapshot.positionId,
      payload: {
        symbol: trade.symbol,
        side: sideToClose,
        qty,
        avgPrice: entryPrice,
        executedQty: qty,
        orderId: reconcileOrderId,
        source: "RECONCILIATION_BACKFILL",
        reason: "LOCAL_OPEN_TRADE_BINANCE_FLAT",
      },
    });

    await appendEvent({
      type: "POSITION_CLOSED",
      environment: "testnet",
      runId: trade.runId,
      decisionLogId: trade.decisionLogId,
      tradeId: trade.tradeId,
      previewId: trade.previewId,
      positionId: snapshot.positionId,
      payload: {
        symbol: trade.symbol,
        sideToClose,
        qty,
        closeOrderId: reconcileOrderId,
        source: "RECONCILIATION_BACKFILL",
        reason: "LOCAL_OPEN_TRADE_BINANCE_FLAT",
        realizedPnlPending: true,
      },
    });

    await calculatePnlForTrade(trade.tradeId);
  }
}

export async function getOpenPositionsView(): Promise<OpenPositionsResponse> {
  const events = await getEvents();
  const openTrades = buildOpenTradesFromEvents(events);

  if (openTrades.length === 0) {
    return {
      snapshots: [],
      reconciliation: {
        status: "OK",
        issues: [],
        openTradeCount: 0,
        binancePositionCount: 0,
        lastMonitoredAt: null,
      },
      message: "No open trades — zero state.",
    };
  }

  const latestSnapshots = getLatestMonitoredSnapshots(events);
  const snapshots = openTrades.map(
    (t) => latestSnapshots.get(t.tradeId) ?? buildUnknownSnapshot(t, latestSnapshots),
  );
  const lastMonitoredAt = getLatestMonitoredAt(events);
  const reconciliation = reconcilePositions({
    openTrades,
    binancePositions: [],
    snapshots,
    lastMonitoredAt,
    maxOpenPositions: getMaxOpenPositions(),
    binanceConnected: false,
  });

  return {
    snapshots,
    reconciliation,
    message:
      snapshots.length > 0
        ? "Open positions from journal — refresh to sync with Binance."
        : "No open positions.",
  };
}

function buildUnknownSnapshot(
  trade: OpenTrade,
  existing: Map<string, PositionSnapshot>,
): PositionSnapshot {
  return buildSnapshotFromSources({
    trade,
    positionId: resolvePositionId(trade.tradeId, existing),
    binancePos: null,
    refreshedAt: trade.openedAt,
    connected: false,
  });
}

export interface RefreshPositionsInput {
  client?: BinanceTestnetClient;
  getBinanceStatus?: () => Promise<BinanceTestnetStatus>;
}

export interface RefreshPositionsResult extends OpenPositionsResponse {
  ok: boolean;
}

export async function refreshOpenPositions(
  input: RefreshPositionsInput = {},
): Promise<RefreshPositionsResult> {
  const events = await getEvents();
  const openTrades = buildOpenTradesFromEvents(events);
  const refreshedAt = new Date().toISOString();
  const existingSnapshots = getLatestMonitoredSnapshots(events);

  if (openTrades.length === 0) {
    return {
      ok: true,
      snapshots: [],
      reconciliation: {
        status: "OK",
        issues: [],
        openTradeCount: 0,
        binancePositionCount: 0,
        lastMonitoredAt: null,
      },
      message: "No open trades — zero state.",
    };
  }

  const connected = input.getBinanceStatus
    ? isBinanceConnected(await input.getBinanceStatus())
    : (await resolveTestnetConnectionStatus()).connected;

  let binancePositions: BinancePosition[] = [];
  if (connected) {
    try {
      const client = input.client ?? createBinanceTestnetClient();
      binancePositions = filterNonZeroBinancePositions(await client.getPositions());
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to fetch positions";
      await appendEvent({
        type: "ERROR_RECORDED",
        environment: "testnet",
        payload: { phase: "POSITION_REFRESH", message },
      });
    }
  }

  const snapshots: PositionSnapshot[] = [];

  for (const trade of openTrades) {
    const binancePos = connected ? findBinanceForTrade(trade, binancePositions) : null;
    const positionId = resolvePositionId(trade.tradeId, existingSnapshots);
    const snapshot = buildSnapshotFromSources({
      trade,
      positionId,
      binancePos,
      refreshedAt,
      connected,
    });
    snapshots.push(snapshot);

    await appendEvent({
      type: "POSITION_MONITORED",
      environment: "testnet",
      runId: trade.runId,
      decisionLogId: trade.decisionLogId,
      previewId: trade.previewId,
      tradeId: trade.tradeId,
      positionId,
      payload: { ...snapshot },
    });
  }

  if (connected) {
    await reconcileOrphanFlatTrades(openTrades, snapshots, binancePositions);
  }

  const eventsAfterReconcile = await getEvents();
  const openTradesAfter = buildOpenTradesFromEvents(eventsAfterReconcile);
  const snapshotsAfter = openTradesAfter.map(
    (t) =>
      getLatestMonitoredSnapshots(eventsAfterReconcile).get(t.tradeId) ??
      buildUnknownSnapshot(t, getLatestMonitoredSnapshots(eventsAfterReconcile)),
  );

  const reconciliation = reconcilePositions({
    openTrades: openTradesAfter,
    binancePositions,
    snapshots: snapshotsAfter,
    lastMonitoredAt: refreshedAt,
    maxOpenPositions: getMaxOpenPositions(),
    binanceConnected: connected,
  });

  if (reconciliation.issues.length > 0) {
    const primary = openTradesAfter[0] ?? openTrades[0];
    await appendEvent({
      type: "POSITION_RECONCILIATION_WARNING",
      environment: "testnet",
      runId: primary?.runId,
      decisionLogId: primary?.decisionLogId,
      tradeId: primary?.tradeId,
      payload: {
        status: reconciliation.status,
        issues: reconciliation.issues,
        openTradeCount: reconciliation.openTradeCount,
        binancePositionCount: reconciliation.binancePositionCount,
      },
    });
  }

  const updatedEvents = await getEvents();
  const mission = buildMissionSnapshot(updatedEvents);
  const primary = openTradesAfter[0] ?? openTrades[0];
  await appendEvent({
    type: "MISSION_SNAPSHOT_UPDATED",
    environment: "testnet",
    runId: primary?.runId,
    decisionLogId: primary?.decisionLogId,
    tradeId: primary?.tradeId,
    payload: {
      currentEquity: mission.currentEquity,
      netPnl: mission.netPnl,
      openPositions: mission.openPositions,
      totalTrades: mission.totalTrades,
      phase: "POSITION_REFRESH",
    },
  });

  return {
    ok: true,
    snapshots: snapshotsAfter,
    reconciliation,
    message: connected
      ? "Positions refreshed from Binance testnet."
      : "Binance not connected — position state unknown.",
  };
}

export async function getReconciliationStatus(): Promise<ReconciliationResult> {
  const events = await getEvents();
  const openTrades = buildOpenTradesFromEvents(events);
  const snapshots = Array.from(getLatestMonitoredSnapshots(events).values());
  const lastMonitoredAt = getLatestMonitoredAt(events);
  const testnet = await resolveTestnetConnectionStatus();
  const connected = testnet.connected;

  return reconcilePositions({
    openTrades,
    binancePositions: [],
    snapshots,
    lastMonitoredAt,
    maxOpenPositions: getMaxOpenPositions(),
    binanceConnected: connected,
  });
}

export function getSnapshotForTrade(
  tradeId: string,
  events: JournalEvent[],
): PositionSnapshot | null {
  return getLatestMonitoredSnapshots(events).get(tradeId) ?? null;
}
