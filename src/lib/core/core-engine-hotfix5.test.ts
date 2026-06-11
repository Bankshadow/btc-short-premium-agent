import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { mapBundleToDashboardMetrics } from "./dashboard-projection-map";
import { getProjectionBundleForUI } from "./projection-client";
import {
  getDefaultMissionProjection,
  getDefaultProjectionBundle,
  getDefaultTradeProjection,
  PROJECTION_FALLBACK_ACTIVE_MESSAGE,
} from "./projection-defaults";
import { unwrapProjectionBundle } from "./unwrap-projection-bundle";
import { runUiConsistencyCheck } from "./ui-consistency-check";
import { validateTradeEvidence } from "@/lib/evidence/evidence-validator";
import { buildEvidenceProgressFromEvents } from "@/lib/evidence/evidence-progress";
import { buildClosedTradesFromEvents } from "@/lib/trades/trade-store";
import { isLiveEnabled } from "@/lib/risk/risk-gate";
import type { JournalEvent } from "@/lib/journal/journal-types";

function pendingPnlClosedEvents(tradeId: string): JournalEvent[] {
  const base = { environment: "testnet" as const, tradeId, runId: "r1", decisionLogId: "dl1" };
  return [
    { eventId: "1", timestamp: "2026-06-11T10:00:00.000Z", type: "ORDER_EXECUTED", ...base, payload: { qty: "0.0000", orderId: "1" } },
    { eventId: "2", timestamp: "2026-06-11T10:00:01.000Z", type: "POSITION_OPENED", ...base, payload: { entryPrice: null, qty: "0.0000" } },
    { eventId: "3", timestamp: "2026-06-11T10:00:02.000Z", type: "POSITION_MONITORED", ...base, payload: {} },
    { eventId: "4", timestamp: "2026-06-11T10:00:03.000Z", type: "CLOSE_ORDER_EXECUTED", ...base, payload: { avgPrice: 0 } },
    { eventId: "5", timestamp: "2026-06-11T10:00:04.000Z", type: "POSITION_CLOSED", ...base, payload: { realizedPnlPending: true, source: "RECONCILIATION_BACKFILL" } },
    { eventId: "6", timestamp: "2026-06-11T10:00:05.000Z", type: "PNL_REALIZED", ...base, payload: { source: "ZERO_FILL_RECONCILIATION", result: "BREAKEVEN", entryPrice: null, exitPrice: 0, qty: "0" } },
    { eventId: "7", timestamp: "2026-06-11T10:00:06.000Z", type: "LEARNING_RECORD_CREATED", ...base, payload: {} },
  ];
}

describe("Core Engine hotfix 5 — UI projection source + strict evidence", () => {
  it("unwrapProjectionBundle handles nested ok envelope", () => {
    const json = {
      ok: true,
      data: {
        ok: true,
        mission: { totalTrades: 8 },
        trades: { open: [], closed: Array.from({ length: 8 }, (_, i) => ({ tradeId: `t${i}` })) },
      },
      error: null,
    };
    const result = unwrapProjectionBundle(json);
    assert.equal(result.payload?.mission?.totalTrades, 8);
    assert.equal(result.payload?.trades?.closed?.length, 8);
  });

  it("getProjectionBundleForUI returns isFallback false for valid nested bundle", async () => {
    const prev = global.fetch;
    global.fetch = async (input) => {
      const url = String(input);
      if (url.includes("/api/core/projections/bundle")) {
        return new Response(
          JSON.stringify({
            ok: true,
            data: {
              ok: true,
              mission: { ...getDefaultMissionProjection(), totalTrades: 8, zeroState: false },
              trades: {
                ...getDefaultTradeProjection(),
                open: [],
                closed: Array.from({ length: 8 }, (_, i) => ({ tradeId: `t${i}`, status: "CLOSED_PENDING_PNL" })),
                effectiveOpenCount: 0,
                closedCount: 8,
              },
              positions: getDefaultProjectionBundle().positions,
              pnl: getDefaultProjectionBundle().pnl,
              evidence: { ...getDefaultProjectionBundle().evidence, valid: 0, required: 12, rejected: 8 },
              risk: { liveLocked: true },
              health: { status: "WARNING", exchangeStatus: "CONNECTED", liveLocked: true },
              meta: { eventCount: 699, builtAt: new Date().toISOString(), cacheKey: "699" },
            },
            error: null,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      if (url.includes("/api/binance/status")) {
        return new Response(JSON.stringify({ ok: true, data: { status: "CONNECTED", zeroState: false }, error: null }), {
          status: 200,
        });
      }
      throw new Error("unexpected");
    };
    try {
      const result = await getProjectionBundleForUI({ includeBinance: true, timeoutMs: 500 });
      assert.equal(result.isFallback, false);
      assert.equal(result.bundle.mission.totalTrades, 8);
      assert.equal(result.bundle.trades.closed.length, 8);
      assert.ok(!result.warnings.includes(PROJECTION_FALLBACK_ACTIVE_MESSAGE));
    } finally {
      global.fetch = prev;
    }
  });

  it("getProjectionBundleForUI returns isFallback true when fetch fails", async () => {
    const prev = global.fetch;
    global.fetch = async () => {
      throw new Error("network down");
    };
    try {
      const result = await getProjectionBundleForUI({ includeBinance: false, timeoutMs: 100 });
      assert.equal(result.isFallback, true);
      assert.ok(result.warnings.includes(PROJECTION_FALLBACK_ACTIVE_MESSAGE));
    } finally {
      global.fetch = prev;
    }
  });

  it("mapBundleToDashboardMetrics maps mission and closed counts", () => {
    const bundle = getDefaultProjectionBundle();
    bundle.ok = true;
    bundle.mission = { ...getDefaultMissionProjection(), totalTrades: 8, zeroState: false };
    bundle.trades = {
      ...getDefaultTradeProjection(),
      open: [],
      closed: Array.from({ length: 8 }, (_, i) => ({ tradeId: `t${i}` })) as typeof bundle.trades.closed,
      effectiveOpenCount: 0,
      closedCount: 0,
      openCount: 0,
    };
    bundle.evidence = { ...bundle.evidence, valid: 0, required: 12 };
    bundle.health = { ...bundle.health!, status: "WARNING" };

    const metrics = mapBundleToDashboardMetrics(bundle);
    assert.equal(metrics.totalTrades, 8);
    assert.equal(metrics.openTrades, 0);
    assert.equal(metrics.closedTrades, 8);
    assert.equal(metrics.usingFallback, false);
    assert.equal(metrics.coreHealthStatus, "WARNING");
  });

  it("strict evidence rejects PENDING_PNL closed trade projection", () => {
    const events = pendingPnlClosedEvents("pending-1");
    const closed = buildClosedTradesFromEvents(events)[0];
    const result = validateTradeEvidence("pending-1", events, closed);
    assert.equal(result.status, "REJECTED");
    assert.ok(result.rejectionReasons.includes("PNL_PENDING_DATA"));
    assert.ok(result.rejectionReasons.includes("ZERO_QTY"));
    assert.ok(result.rejectionReasons.includes("MISSING_ENTRY_PRICE"));
  });

  it("strict evidence progress is 0 valid when all trades pending PnL", () => {
    const events = pendingPnlClosedEvents("pending-1");
    const progress = buildEvidenceProgressFromEvents(events);
    assert.equal(progress.valid, 0);
    assert.equal(progress.rejected, 1);
  });

  it("ui-consistency exposes browserDomChecksAvailable false", async () => {
    const report = await runUiConsistencyCheck();
    assert.equal(report.browserDomChecksAvailable, false);
    assert.ok(report.note.includes("not rendered DOM values"));
  });

  it("AppShell mounts shared ProjectionBundleProvider", () => {
    const shell = fs.readFileSync(path.join(process.cwd(), "src", "components", "AppShell.tsx"), "utf8");
    assert.ok(shell.includes("ProjectionBundleProvider"));
  });

  it("trades page uses bundle only", () => {
    const src = fs.readFileSync(path.join(process.cwd(), "src", "app", "trades", "page.tsx"), "utf8");
    assert.ok(src.includes("useProjectionBundle"));
    assert.ok(!src.includes("useApi<TradesResponse>"));
  });

  it("core page shows aggregated warning count", () => {
    const src = fs.readFileSync(path.join(process.cwd(), "src", "app", "core", "page.tsx"), "utf8");
    assert.ok(src.includes("warningCount"));
    assert.ok(src.includes("resolveCoreHealthStatus"));
  });

  it("no live trading enabled", () => {
    assert.equal(isLiveEnabled(), false);
  });

  it("no secrets exposed on hotfix 5 pages", () => {
    for (const rel of ["page.tsx", "trades/page.tsx", "reports/page.tsx", "core/page.tsx"]) {
      const src = fs.readFileSync(path.join(process.cwd(), "src", "app", rel), "utf8");
      assert.ok(!src.includes("BINANCE_API_SECRET"));
      assert.ok(!src.includes("process.env.BINANCE"));
    }
  });
});
