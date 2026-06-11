import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { mapBundleToDashboardMetrics } from "./dashboard-projection-map";
import { getProjectionBundle } from "./projection-client";
import {
  getDefaultMissionProjection,
  getDefaultProjectionBundle,
  getDefaultTradeProjection,
  PROJECTION_FALLBACK_ACTIVE_MESSAGE,
} from "./projection-defaults";
import { unwrapProjectionBundle } from "./unwrap-projection-bundle";
import {
  bundleProjectionReady,
  pickClosedTradeCount,
  resolveCoreHealthStatus,
} from "./ui-projection-bind";
import { validateTradeEvidence } from "@/lib/evidence/evidence-validator";
import { buildEvidenceProgressFromEvents } from "@/lib/evidence/evidence-progress";
import { isLiveEnabled } from "@/lib/risk/risk-gate";
import type { JournalEvent } from "@/lib/journal/journal-types";

function fullLifecyclePendingPnlEvents(tradeId: string): JournalEvent[] {
  const base = {
    environment: "testnet" as const,
    tradeId,
    runId: "run-1",
    decisionLogId: "dl-1",
  };
  return [
    { eventId: "1", timestamp: "2026-06-11T10:00:00.000Z", type: "ORDER_EXECUTED", ...base, payload: { qty: "0", orderId: "1" } },
    { eventId: "2", timestamp: "2026-06-11T10:00:01.000Z", type: "POSITION_OPENED", ...base, payload: { entryPrice: null, qty: "0" } },
    { eventId: "3", timestamp: "2026-06-11T10:00:02.000Z", type: "POSITION_MONITORED", ...base, payload: {} },
    { eventId: "4", timestamp: "2026-06-11T10:00:03.000Z", type: "CLOSE_ORDER_EXECUTED", ...base, payload: { avgPrice: 0 } },
    { eventId: "5", timestamp: "2026-06-11T10:00:04.000Z", type: "POSITION_CLOSED", ...base, payload: { realizedPnlPending: true, source: "RECONCILIATION_BACKFILL" } },
    { eventId: "6", timestamp: "2026-06-11T10:00:05.000Z", type: "PNL_REALIZED", ...base, payload: { source: "ZERO_FILL_RECONCILIATION", result: "BREAKEVEN", entryPrice: null, exitPrice: 0, qty: "0" } },
    { eventId: "7", timestamp: "2026-06-11T10:00:06.000Z", type: "LEARNING_RECORD_CREATED", ...base, payload: {} },
  ];
}

describe("Core Engine hotfix 4 — UI binding + evidence strictness", () => {
  it("unwrapProjectionBundle handles Case A nested ok envelope", () => {
    const json = {
      ok: true,
      data: {
        ok: true,
        mission: { totalTrades: 8 },
        trades: { open: [], closed: Array.from({ length: 8 }, (_, i) => ({ tradeId: `t${i}` })) },
        evidence: { valid: 0, required: 12 },
        health: { status: "WARNING" },
      },
      error: null,
    };
    const result = unwrapProjectionBundle(json);
    assert.equal(result.valid, true);
    assert.equal(result.payload?.mission?.totalTrades, 8);
    assert.equal(result.payload?.trades?.closed?.length, 8);
    assert.equal(result.usedFallback, false);
  });

  it("unwrapProjectionBundle handles Case B flat data envelope", () => {
    const json = {
      ok: true,
      data: {
        mission: { totalTrades: 8 },
        trades: { open: [], closed: [{ tradeId: "t1" }] },
      },
      error: null,
    };
    const result = unwrapProjectionBundle(json);
    assert.equal(result.valid, true);
    assert.equal(result.payload?.mission?.totalTrades, 8);
  });

  it("unwrapProjectionBundle marks Case C as invalid fallback", () => {
    const json = {
      ok: false,
      data: { mission: { totalTrades: 0 }, trades: { open: [], closed: [] } },
      error: { code: "PROJECTION_FALLBACK" },
    };
    const result = unwrapProjectionBundle(json);
    assert.equal(result.valid, false);
    assert.equal(result.usedFallback, true);
  });

  it("mapBundleToDashboardMetrics uses real bundle values without fallback flag", () => {
    const bundle = getDefaultProjectionBundle();
    bundle.ok = true;
    bundle.mission = {
      ...getDefaultMissionProjection(),
      zeroState: false,
      totalTrades: 8,
      currentEquity: 1000,
      targetCapital: 10000,
      progressPct: 10,
      netPnl: 0,
    };
    bundle.trades = {
      ...getDefaultTradeProjection(),
      zeroState: false,
      open: [],
      closed: Array.from({ length: 8 }, (_, i) => ({ tradeId: `t${i}` })) as typeof bundle.trades.closed,
      effectiveOpenCount: 0,
      closedCount: 8,
    };
    bundle.evidence = { ...bundle.evidence, valid: 0, required: 12, zeroState: false };
    bundle.health = { ...bundle.health!, status: "WARNING" };

    const metrics = mapBundleToDashboardMetrics(bundle);
    assert.equal(metrics.totalTrades, 8);
    assert.equal(metrics.closedTrades, 8);
    assert.equal(metrics.openTrades, 0);
    assert.equal(metrics.evidenceValid, 0);
    assert.equal(metrics.evidenceRequired, 12);
    assert.equal(metrics.coreHealthStatus, "WARNING");
    assert.equal(metrics.usingFallback, false);
  });

  it("getProjectionBundle sets ok true for valid nested bundle without fallback warning", async () => {
    const prev = global.fetch;
    global.fetch = async (input) => {
      const url = String(input);
      if (url.includes("/api/core/projections/bundle")) {
        return new Response(
          JSON.stringify({
            ok: true,
            data: {
              ok: true,
              mission: { ...getDefaultMissionProjection(), totalTrades: 8, zeroState: false, latestRunId: "r1" },
              trades: {
                ...getDefaultTradeProjection(),
                open: [],
                closed: Array.from({ length: 8 }, (_, i) => ({ tradeId: `t${i}` })),
                effectiveOpenCount: 0,
                closedCount: 8,
                zeroState: false,
              },
              positions: getDefaultProjectionBundle().positions,
              pnl: getDefaultProjectionBundle().pnl,
              evidence: { ...getDefaultProjectionBundle().evidence, valid: 0, required: 12 },
              risk: { liveLocked: true },
              health: { status: "WARNING", exchangeStatus: "CONNECTED", liveLocked: true },
              meta: { eventCount: 699, builtAt: new Date().toISOString(), cacheKey: "699:x" },
            },
            error: null,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      if (url.includes("/api/binance/status")) {
        return new Response(
          JSON.stringify({ ok: true, data: { status: "CONNECTED", zeroState: false }, error: null }),
          { status: 200 },
        );
      }
      throw new Error("unexpected");
    };
    try {
      const bundle = await getProjectionBundle({ includeBinance: true, timeoutMs: 500 });
      assert.equal(bundle.ok, true);
      assert.equal(bundle.mission.totalTrades, 8);
      assert.equal(bundle.trades.closed.length, 8);
      assert.ok(!bundle.warnings.includes(PROJECTION_FALLBACK_ACTIVE_MESSAGE));
    } finally {
      global.fetch = prev;
    }
  });

  it("bundleProjectionReady prefers bundle over useApi fallback summary", () => {
    const bundle = getDefaultProjectionBundle();
    bundle.ok = true;
    bundle.mission.totalTrades = 8;
    bundle.trades.closed = Array.from({ length: 8 }, (_, i) => ({ tradeId: `t${i}` })) as typeof bundle.trades.closed;
    assert.equal(bundleProjectionReady(bundle), true);
    assert.equal(pickClosedTradeCount(bundle), 8);
  });

  it("resolveCoreHealthStatus prefers API health over bundle", () => {
    assert.equal(resolveCoreHealthStatus({ status: "WARNING" }, { status: "OK" }), "WARNING");
    assert.equal(resolveCoreHealthStatus(null, { status: "WARNING" }), "WARNING");
  });

  it("evidence rejects PENDING_PNL zero-fill trades", () => {
    const events = fullLifecyclePendingPnlEvents("pending-1");
    const result = validateTradeEvidence("pending-1", events);
    assert.equal(result.status, "REJECTED");
    assert.ok(result.rejectionReasons.includes("PNL_PENDING_DATA"));
    assert.ok(result.rejectionReasons.includes("ZERO_QTY"));
    assert.ok(result.rejectionReasons.includes("MISSING_ENTRY_PRICE"));
  });

  it("evidence rejects missing entryPrice", () => {
    const events = fullLifecyclePendingPnlEvents("missing-entry");
    const result = validateTradeEvidence("missing-entry", events);
    assert.ok(result.rejectionReasons.includes("MISSING_ENTRY_PRICE"));
  });

  it("evidence rejects zero qty", () => {
    const events = fullLifecyclePendingPnlEvents("zero-qty");
    const result = validateTradeEvidence("zero-qty", events);
    assert.ok(result.rejectionReasons.includes("ZERO_QTY"));
  });

  it("strict evidence progress counts zero valid for pending PnL trades", () => {
    const events = fullLifecyclePendingPnlEvents("strict-1");
    const progress = buildEvidenceProgressFromEvents(events);
    assert.equal(progress.valid, 0);
    assert.equal(progress.required, 12);
    assert.equal(progress.rejected, 1);
  });

  it("evidence does not fake PNL_REALIZED for closed pending trades", () => {
    const events: JournalEvent[] = [
      {
        eventId: "1",
        timestamp: "2026-06-11T10:00:00.000Z",
        type: "POSITION_CLOSED",
        environment: "testnet",
        tradeId: "no-pnl",
        payload: { realizedPnlPending: true },
      },
    ];
    const result = validateTradeEvidence("no-pnl", events);
    assert.equal(result.status, "REJECTED");
    assert.ok(result.rejectionReasons.includes("MISSING_REALIZED_PNL"));
    assert.equal(events.some((e) => e.type === "PNL_REALIZED"), false);
  });

  it("dashboard page binds bundle metrics and health status", () => {
    const src = fs.readFileSync(path.join(process.cwd(), "src", "app", "page.tsx"), "utf8");
    assert.ok(src.includes("mapBundleToDashboardMetrics"));
    assert.ok(src.includes("metrics.coreHealthStatus"));
    assert.ok(src.includes("isFallback"));
  });

  it("trades page prefers bundle when projection ready", () => {
    const src = fs.readFileSync(path.join(process.cwd(), "src", "app", "trades", "page.tsx"), "utf8");
    assert.ok(src.includes("bundleProjectionReady"));
    assert.ok(!src.includes("useApi<TradesResponse>"));
  });

  it("AppShell mounts shared ProjectionBundleProvider once", () => {
    const shell = fs.readFileSync(path.join(process.cwd(), "src", "components", "AppShell.tsx"), "utf8");
    assert.ok(shell.includes("ProjectionBundleProvider"));
  });

  it("core page resolves health from API first", () => {
    const src = fs.readFileSync(path.join(process.cwd(), "src", "app", "core", "page.tsx"), "utf8");
    assert.ok(src.includes("resolveCoreHealthStatus"));
    assert.ok(src.includes("/api/core/health"));
  });

  it("reports page uses strict evidence projection and API health", () => {
    const src = fs.readFileSync(path.join(process.cwd(), "src", "app", "reports", "page.tsx"), "utf8");
    assert.ok(src.includes("projEvidence.valid"));
    assert.ok(src.includes("resolveCoreHealthStatus"));
  });

  it("no live trading enabled", () => {
    assert.equal(isLiveEnabled(), false);
  });

  it("no secrets exposed on hotfix 4 pages", () => {
    for (const rel of ["page.tsx", "trades/page.tsx", "reports/page.tsx", "core/page.tsx"]) {
      const src = fs.readFileSync(path.join(process.cwd(), "src", "app", rel), "utf8");
      assert.ok(!src.includes("BINANCE_API_SECRET"));
      assert.ok(!src.includes("process.env.BINANCE"));
    }
  });
});
