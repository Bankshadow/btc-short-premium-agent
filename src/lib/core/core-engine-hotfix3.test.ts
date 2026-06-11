import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { mapBundleToDashboardMetrics } from "./dashboard-projection-map";
import { unwrapApiData } from "./projection-api-response";
import { getProjectionBundle } from "./projection-client";
import {
  getDefaultMissionProjection,
  getDefaultProjectionBundle,
  getDefaultTradeProjection,
  PROJECTION_FALLBACK_ACTIVE_MESSAGE,
} from "./projection-defaults";
import { runUiConsistencyCheck } from "./ui-consistency-check";
import { applyTradeReconciliation } from "./trade-reconciliation";
import { PNL_PENDING_LABEL, staleTradeBannerText } from "./stale-trade-display";
import { resolveBinanceStatusConsistency } from "@/lib/execution/binance-status-diagnostics";
import { defaultBinanceTestnetStatus } from "@/lib/core/zero-state";
import { buildClosedTradesFromEvents } from "@/lib/trades/trade-store";
import { isLiveEnabled } from "@/lib/risk/risk-gate";
import type { JournalEvent } from "@/lib/journal/journal-types";

describe("Core Engine hotfix 3 — projection mapping + status consistency", () => {
  it("mapBundleToDashboardMetrics uses mission.totalTrades and trade counts", () => {
    const bundle = getDefaultProjectionBundle();
    bundle.ok = true;
    bundle.mission = {
      ...getDefaultMissionProjection(),
      zeroState: false,
      totalTrades: 7,
      currentEquity: 1000,
      targetCapital: 10000,
      progressPct: 0,
      netPnl: 0,
      latestRunId: "run-1",
      latestDecisionLogId: "dl-1",
      latestVerdict: "TRADE",
    };
    bundle.trades = {
      ...getDefaultTradeProjection(),
      zeroState: false,
      open: [],
      closed: Array.from({ length: 7 }, (_, i) => ({ tradeId: `t${i}` })) as typeof bundle.trades.closed,
      openCount: 0,
      closedCount: 7,
      effectiveOpenCount: 0,
    };
    bundle.evidence = { ...bundle.evidence, valid: 3, required: 12, zeroState: false };

    const metrics = mapBundleToDashboardMetrics(bundle);
    assert.equal(metrics.totalTrades, 7);
    assert.equal(metrics.openTrades, 0);
    assert.equal(metrics.closedTrades, 7);
    assert.equal(metrics.usingFallback, false);
  });

  it("mapBundleToDashboardMetrics flags fallback when bundle.ok is false", () => {
    const bundle = getDefaultProjectionBundle();
    assert.equal(bundle.ok, false);
    const metrics = mapBundleToDashboardMetrics(bundle);
    assert.equal(metrics.usingFallback, true);
  });

  it("unwrapApiData handles nested bundle shape with inner ok", () => {
    const nested = {
      ok: true,
      data: {
        ok: true,
        mission: { totalTrades: 7 },
        trades: { open: [], closed: [{ tradeId: "t1" }], effectiveOpenCount: 0 },
        pnl: { totalNetPnl: 0 },
        evidence: { valid: 1, required: 12 },
        risk: { liveLocked: true },
        health: { status: "OK", exchangeStatus: "CONNECTED", liveLocked: true },
      },
      error: null,
    };
    const payload = unwrapApiData<{ mission: { totalTrades: number } }>(nested);
    assert.equal(payload?.mission.totalTrades, 7);
  });

  it("unwrapApiData returns fallback data on ok:false envelope", () => {
    const envelope = {
      ok: false,
      data: { mission: { totalTrades: 0 }, trades: { open: [], closed: [] } },
      error: { code: "PROJECTION_FALLBACK", message: "failed", severity: "WARNING" },
    };
    const payload = unwrapApiData<{ mission: { totalTrades: number } }>(envelope);
    assert.equal(payload?.mission.totalTrades, 0);
  });

  it("getProjectionBundle maps mission.totalTrades from nested API", async () => {
    const prev = global.fetch;
    global.fetch = async (input) => {
      const url = String(input);
      if (url.includes("/api/core/projections/bundle")) {
        return new Response(
          JSON.stringify({
            ok: true,
            data: {
              ok: true,
              mission: { ...getDefaultMissionProjection(), totalTrades: 7, zeroState: false, latestRunId: "r1" },
              trades: {
                ...getDefaultTradeProjection(),
                open: [],
                closed: Array.from({ length: 7 }, (_, i) => ({ tradeId: `t${i}` })),
                effectiveOpenCount: 0,
                zeroState: false,
              },
              positions: getDefaultProjectionBundle().positions,
              pnl: getDefaultProjectionBundle().pnl,
              evidence: getDefaultProjectionBundle().evidence,
              risk: { liveLocked: true },
              health: { status: "WARNING", exchangeStatus: "CONNECTED", liveLocked: true },
              meta: { eventCount: 7, builtAt: new Date().toISOString(), cacheKey: "7:x" },
            },
            error: null,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      if (url.includes("/api/binance/status")) {
        return new Response(
          JSON.stringify({
            ok: true,
            data: {
              status: "CONNECTED",
              apiKeyPresent: true,
              apiSecretPresent: true,
              connected: true,
              zeroState: false,
            },
            error: null,
          }),
          { status: 200 },
        );
      }
      throw new Error("unexpected");
    };
    try {
      const bundle = await getProjectionBundle({ includeBinance: true, timeoutMs: 500 });
      assert.equal(bundle.mission.totalTrades, 7);
      assert.equal(bundle.trades.closedCount, 7);
      assert.equal(bundle.trades.openCount, 0);
      assert.equal(bundle.ok, true);
    } finally {
      global.fetch = prev;
    }
  });

  it("Binance status not MISSING_ENV when keys are present in default zero-state", () => {
    const status = defaultBinanceTestnetStatus({
      apiKeyPresent: true,
      apiSecretPresent: true,
      testnetEnabled: true,
    });
    const resolved = resolveBinanceStatusConsistency(status);
    assert.notEqual(resolved.status, "MISSING_ENV");
    assert.equal(resolved.status, "DISCONNECTED");
  });

  it("resolveBinanceStatusConsistency keeps CONNECTED when probe succeeds", () => {
    const resolved = resolveBinanceStatusConsistency({
      status: "CONNECTED",
      testnetEnabled: true,
      liveEnabled: false,
      apiKeyPresent: true,
      apiSecretPresent: true,
      proxyEnabled: false,
      proxyUrlConfigured: false,
      serverTimeOk: true,
      lastCheckedAt: new Date().toISOString(),
      baseUrl: "https://demo-fapi.binance.com",
      reason: "ok",
      recommendation: "ok",
    });
    assert.equal(resolved.status, "CONNECTED");
  });

  it("stale OPEN + FLAT is not counted as active open", () => {
    const events: JournalEvent[] = [
      {
        eventId: "e1",
        timestamp: "2026-06-11T10:00:00.000Z",
        type: "ORDER_EXECUTED",
        environment: "testnet",
        tradeId: "stale-1",
        payload: { symbol: "BTCUSDT", side: "SELL", qty: "0.001", orderId: "1" },
      },
      {
        eventId: "e2",
        timestamp: "2026-06-11T10:00:01.000Z",
        type: "POSITION_OPENED",
        environment: "testnet",
        tradeId: "stale-1",
        payload: { symbol: "BTCUSDT", side: "SELL", qty: "0.001", entryPrice: 50000 },
      },
      {
        eventId: "e3",
        timestamp: "2026-06-11T10:00:02.000Z",
        type: "POSITION_MONITORED",
        environment: "testnet",
        tradeId: "stale-1",
        payload: { status: "FLAT", qty: "0" },
      },
    ];
    const recon = applyTradeReconciliation(events);
    assert.equal(recon.effectiveOpenCount, 0);
    assert.equal(recon.open.length, 0);
    assert.ok(recon.staleOpenWarnings.length >= 1);
  });

  it("stale trade banner text is visible copy", () => {
    assert.ok(staleTradeBannerText(1).includes("manual repair"));
    assert.ok(staleTradeBannerText(1).toLowerCase().includes("not counted as active exposure"));
  });

  it("closed pending PnL does not create fake PNL_REALIZED", () => {
    const events: JournalEvent[] = [
      {
        eventId: "e1",
        timestamp: "2026-06-11T10:00:00.000Z",
        type: "ORDER_EXECUTED",
        environment: "testnet",
        tradeId: "pending-1",
        payload: { symbol: "BTCUSDT", side: "SELL", qty: "0.001", orderId: "1" },
      },
      {
        eventId: "e2",
        timestamp: "2026-06-11T10:00:01.000Z",
        type: "POSITION_CLOSED",
        environment: "testnet",
        tradeId: "pending-1",
        payload: { realizedPnlPending: true },
      },
    ];
    const closed = buildClosedTradesFromEvents(events);
    assert.equal(closed[0]?.status, "CLOSED_PENDING_PNL");
    assert.equal(events.some((e) => e.type === "PNL_REALIZED"), false);
    assert.equal(PNL_PENDING_LABEL, "PnL pending — missing fill data.");
  });

  it("dashboard page uses canonical UI projection data", () => {
    const src = fs.readFileSync(path.join(process.cwd(), "src", "app", "page.tsx"), "utf8");
    assert.ok(src.includes("useUiProjectionData"));
    assert.ok(src.includes("PROJECTION_FALLBACK_ACTIVE_MESSAGE"));
    assert.ok(!src.includes("openTradeCount = mission.openTrades"));
  });

  it("no secrets exposed on hotfix pages", () => {
    for (const rel of ["page.tsx", "settings/page.tsx", "core/page.tsx", "trades/page.tsx", "reports/page.tsx"]) {
      const src = fs.readFileSync(path.join(process.cwd(), "src", "app", rel), "utf8");
      assert.ok(!src.includes("BINANCE_API_SECRET"));
      assert.ok(!src.includes("process.env.BINANCE"));
    }
  });

  it("live remains locked", () => {
    assert.equal(isLiveEnabled(), false);
    assert.equal(getDefaultMissionProjection().liveLocked, true);
  });

  it("ui-consistency uses STALE_TRADE_MANUAL_REPAIR_REQUIRED as soft warning", async () => {
    const report = await runUiConsistencyCheck();
    assert.ok(["OK", "WARNING", "BLOCKED"].includes(report.status));
    const stale = report.checks.find((c) => c.id === "STALE_TRADE_MANUAL_REPAIR_REQUIRED");
    if (stale) {
      assert.equal(stale.ok, false);
      assert.ok(!report.mismatches.some((m) => m.id === "STALE_TRADE_MANUAL_REPAIR_REQUIRED"));
      assert.equal(report.status, "WARNING");
    }
  });
});
