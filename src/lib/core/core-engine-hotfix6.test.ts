import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { mapBundleToDashboardMetrics } from "./dashboard-projection-map";
import { normalizeProjectionBundle } from "./normalize-projection-bundle";
import { getProjectionBundleForUI } from "./projection-client";
import {
  inspectProjectionBundleShape,
  extractProjectionBundlePayload,
} from "./projection-bundle-shape";
import {
  getDefaultMissionProjection,
  getDefaultProjectionBundle,
  getDefaultTradeProjection,
  PROJECTION_FALLBACK_ACTIVE_MESSAGE,
} from "./projection-defaults";
import { resolveBinanceStatusConsistency } from "@/lib/execution/binance-status-diagnostics";
import { defaultBinanceTestnetStatus } from "@/lib/core/zero-state";
import { validateTradeEvidence } from "@/lib/evidence/evidence-validator";
import { buildEvidenceProgressFromEvents } from "@/lib/evidence/evidence-progress";
import { buildClosedTradesFromEvents } from "@/lib/trades/trade-store";
import { isLiveEnabled } from "@/lib/risk/risk-gate";
import type { JournalEvent } from "@/lib/journal/journal-types";

function productionLikeBundleEnvelope() {
  return {
    ok: true,
    data: {
      ok: true,
      mission: { ...getDefaultMissionProjection(), totalTrades: 8, zeroState: false },
      trades: {
        ...getDefaultTradeProjection(),
        open: [],
        closed: Array.from({ length: 8 }, (_, i) => ({
          tradeId: `t${i}`,
          status: "CLOSED_PENDING_PNL",
          result: "PENDING_PNL",
        })),
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
  };
}

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

describe("Core Engine hotfix 6 — debug shape + UI binding", () => {
  it("inspectProjectionBundleShape returns safe redacted summary for production envelope", () => {
    const shape = inspectProjectionBundleShape(productionLikeBundleEnvelope());
    assert.equal(shape.ok, true);
    assert.ok(shape.topLevelKeys.includes("data"));
    assert.ok(shape.dataKeys.includes("mission"));
    assert.equal(shape.hasMission, true);
    assert.equal(shape.hasTrades, true);
    assert.equal(shape.sampleValues.missionTotalTrades, 8);
    assert.equal(shape.sampleValues.tradesClosedLength, 8);
    assert.equal(shape.sampleValues.effectiveOpenCount, 0);
    assert.equal(shape.sampleValues.evidenceValid, 0);
    assert.equal(shape.sampleValues.evidenceRequired, 12);
    assert.equal(shape.sampleValues.healthStatus, "WARNING");
    assert.ok(shape.checkedAt.length > 0);
  });

  it("debug-shape response does not expose secrets", () => {
    const raw = productionLikeBundleEnvelope();
    (raw.data as Record<string, unknown>).binanceStatus = {
      status: "CONNECTED",
      apiKey: "super-secret-key",
      apiSecret: "super-secret-secret",
    };
    const shape = inspectProjectionBundleShape(raw);
    const serialized = JSON.stringify(shape);
    assert.ok(!serialized.includes("super-secret-key"));
    assert.ok(!serialized.includes("super-secret-secret"));
    assert.ok(!serialized.includes("apiSecret"));
  });

  it("normalizeProjectionBundle handles nested production envelope", () => {
    const normalized = normalizeProjectionBundle(productionLikeBundleEnvelope());
    assert.equal(normalized.isFallback, false);
    assert.equal(normalized.mission.totalTrades, 8);
    assert.equal(normalized.trades.closed.length, 8);
    assert.equal(normalized.trades.effectiveOpenCount, 0);
    assert.equal(normalized.evidence.valid, 0);
    assert.equal(normalized.evidence.required, 12);
    assert.equal(normalized.health.status, "WARNING");
  });

  it("normalizeProjectionBundle falls back when mission or trades missing", () => {
    const missingMission = normalizeProjectionBundle({ ok: true, data: { trades: { open: [], closed: [] } } });
    assert.equal(missingMission.isFallback, true);
    assert.ok(missingMission.warnings.includes(PROJECTION_FALLBACK_ACTIVE_MESSAGE));

    const missingTrades = normalizeProjectionBundle({
      ok: true,
      data: { mission: { totalTrades: 1 } },
    });
    assert.equal(missingTrades.isFallback, true);
  });

  it("extractProjectionBundlePayload unwraps nested data layer", () => {
    const payload = extractProjectionBundlePayload(productionLikeBundleEnvelope());
    assert.ok(payload?.mission);
    assert.ok(payload?.trades);
    assert.equal(payload?.mission?.totalTrades, 8);
  });

  it("getProjectionBundleForUI returns REAL_BUNDLE for valid nested bundle", async () => {
    const prev = global.fetch;
    global.fetch = async (input) => {
      const url = String(input);
      if (url.includes("/api/core/projections/bundle")) {
        return new Response(JSON.stringify(productionLikeBundleEnvelope()), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (url.includes("/api/binance/status")) {
        return new Response(
          JSON.stringify({
            ok: true,
            data: {
              status: "CONNECTED",
              apiKeyPresent: true,
              apiSecretPresent: true,
              zeroState: false,
            },
            error: null,
          }),
          { status: 200 },
        );
      }
      throw new Error(`unexpected fetch: ${url}`);
    };
    try {
      const result = await getProjectionBundleForUI({ includeBinance: true, timeoutMs: 500 });
      assert.equal(result.debugSource, "REAL_BUNDLE");
      assert.equal(result.isFallback, false);
      assert.equal(result.bundle.mission.totalTrades, 8);
      assert.equal(result.bundle.trades.closed.length, 8);
      assert.ok(!result.warnings.includes(PROJECTION_FALLBACK_ACTIVE_MESSAGE));
    } finally {
      global.fetch = prev;
    }
  });

  it("mapBundleToDashboardMetrics uses normalized trade counts", () => {
    const normalized = normalizeProjectionBundle(productionLikeBundleEnvelope());
    const bundle = getDefaultProjectionBundle();
    bundle.ok = true;
    bundle.mission = normalized.mission as typeof bundle.mission;
    bundle.trades = normalized.trades as typeof bundle.trades;
    bundle.evidence = normalized.evidence as typeof bundle.evidence;
    bundle.health = normalized.health;

    const metrics = mapBundleToDashboardMetrics(bundle);
    assert.equal(metrics.totalTrades, 8);
    assert.equal(metrics.openTrades, 0);
    assert.equal(metrics.closedTrades, 8);
    assert.equal(metrics.evidenceValid, 0);
    assert.equal(metrics.evidenceRequired, 12);
    assert.equal(metrics.coreHealthStatus, "WARNING");
    assert.equal(metrics.usingFallback, false);
  });

  it("Binance status not MISSING_ENV when keys present", () => {
    const status = defaultBinanceTestnetStatus({
      apiKeyPresent: true,
      apiSecretPresent: true,
      testnetEnabled: true,
    });
    const resolved = resolveBinanceStatusConsistency(status);
    assert.notEqual(resolved.status, "MISSING_ENV");
  });

  it("Binance status forced to MISSING_ENV when keys missing", () => {
    const resolved = resolveBinanceStatusConsistency({
      status: "DISCONNECTED",
      testnetEnabled: true,
      liveEnabled: false,
      apiKeyPresent: false,
      apiSecretPresent: false,
      proxyEnabled: false,
      proxyUrlConfigured: false,
      serverTimeOk: false,
      lastCheckedAt: new Date().toISOString(),
      baseUrl: "https://demo-fapi.binance.com",
      reason: "other",
      recommendation: "other",
    });
    assert.equal(resolved.status, "MISSING_ENV");
  });

  it("evidence rejects PENDING_PNL trades", () => {
    const events = pendingPnlClosedEvents("pending-1");
    const closed = buildClosedTradesFromEvents(events)[0];
    const result = validateTradeEvidence("pending-1", events, closed);
    assert.equal(result.status, "REJECTED");
    assert.ok(result.rejectionReasons.includes("PNL_PENDING_DATA"));

    const progress = buildEvidenceProgressFromEvents(events);
    assert.equal(progress.valid, 0);
  });

  it("live trading remains locked", () => {
    assert.equal(isLiveEnabled(), false);
  });

  it("dashboard exposes projection source diagnostic banner", () => {
    const src = fs.readFileSync(path.join(process.cwd(), "src", "app", "dashboard-client.tsx"), "utf8");
    assert.ok(src.includes("Projection source:"));
    assert.ok(src.includes("ui.source") || src.includes("debugSource"));
    assert.ok(src.includes("ui.mission.totalTrades") || src.includes("debugSummary.totalTrades"));
  });

  it("reports page uses bundle binance status not legacy summary", () => {
    const src = fs.readFileSync(path.join(process.cwd(), "src", "app", "reports", "reports-client.tsx"), "utf8");
    assert.ok(src.includes("useUiProjectionData"));
    assert.ok(src.includes("data={ui.binanceStatus}"));
    assert.ok(!src.includes("data={reportData.binanceStatus}"));
  });

  it("projection provider loads via getUiProjectionData", () => {
    const src = fs.readFileSync(
      path.join(process.cwd(), "src", "components", "projection-bundle-provider.tsx"),
      "utf8",
    );
    assert.ok(src.includes("getUiProjectionData"));
  });

  it("debug-shape route file exists", () => {
    const route = path.join(
      process.cwd(),
      "src",
      "app",
      "api",
      "core",
      "projections",
      "debug-shape",
      "route.ts",
    );
    assert.ok(fs.existsSync(route));
    const src = fs.readFileSync(route, "utf8");
    assert.ok(src.includes("inspectProjectionBundleShape"));
  });
});
