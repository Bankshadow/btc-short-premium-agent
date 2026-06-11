import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import {
  normalizeBinanceStatusForDisplay,
  binanceStatusForUiPanel,
} from "@/lib/binance/normalize-binance-status";
import {
  getDefaultMissionProjection,
  getDefaultProjectionBundle,
  getDefaultTradeProjection,
} from "./projection-defaults";
import {
  getDefaultUiProjectionData,
  getUiProjectionData,
  mapNormalizedToUiProjectionData,
} from "./ui-projection-data";
import { normalizeProjectionBundle } from "./normalize-projection-bundle";
import { isLiveEnabled } from "@/lib/risk/risk-gate";
import { PNL_PENDING_LABEL, staleTradeBannerText } from "./stale-trade-display";

function productionBundleEnvelope(totalTrades = 7) {
  return {
    ok: true,
    data: {
      ok: true,
      mission: { ...getDefaultMissionProjection(), totalTrades, zeroState: false },
      trades: {
        ...getDefaultTradeProjection(),
        open: [],
        closed: Array.from({ length: totalTrades }, (_, i) => ({
          tradeId: `t${i}`,
          status: "CLOSED_PENDING_PNL",
          result: "PENDING_PNL",
        })),
        effectiveOpenCount: 0,
        staleOpenWarnings: [{ tradeId: "stale-1", projectedStatus: "OPEN_FLAT" }],
      },
      positions: getDefaultProjectionBundle().positions,
      pnl: getDefaultProjectionBundle().pnl,
      evidence: { ...getDefaultProjectionBundle().evidence, valid: 0, required: 12, rejected: totalTrades },
      risk: { liveLocked: true },
      health: { status: "WARNING", exchangeStatus: "CONNECTED", liveLocked: true, warnings: [] },
      meta: { eventCount: 385, builtAt: new Date().toISOString(), cacheKey: "385" },
    },
    error: null,
  };
}

describe("Core Engine hotfix 7 — UI real bundle binding", () => {
  it("getUiProjectionData returns REAL_BUNDLE for valid bundle", async () => {
    const prev = global.fetch;
    global.fetch = async (input) => {
      const url = String(input);
      if (url.includes("/api/core/projections/bundle")) {
        return new Response(JSON.stringify(productionBundleEnvelope(7)), {
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
              proxyEnabled: true,
              proxyUrlConfigured: true,
            },
            error: null,
          }),
          { status: 200 },
        );
      }
      throw new Error(`unexpected: ${url}`);
    };
    try {
      const ui = await getUiProjectionData({ includeBinance: true, timeoutMs: 500 });
      assert.equal(ui.source, "REAL_BUNDLE");
      assert.equal(ui.isFallback, false);
      assert.equal(ui.mission.totalTrades, 7);
      assert.equal(ui.mission.closedTrades, 7);
      assert.equal(ui.mission.openTrades, 0);
      assert.equal(ui.evidence.valid, 0);
      assert.equal(ui.evidence.required, 12);
      assert.equal(ui.health.status, "WARNING");
      assert.equal(ui.trades.staleOpenWarnings.length, 1);
    } finally {
      global.fetch = prev;
    }
  });

  it("mapNormalizedToUiProjectionData preserves bundle trade counts", () => {
    const normalized = normalizeProjectionBundle(productionBundleEnvelope(7));
    const ui = mapNormalizedToUiProjectionData(normalized, { source: "REAL_BUNDLE" });
    assert.equal(ui.mission.totalTrades, 7);
    assert.equal(ui.mission.closedTrades, 7);
    assert.equal(ui.health.status, "WARNING");
  });

  it("normalizeBinanceStatusForDisplay maps MISSING_ENV to DISCONNECTED when keys present", () => {
    const normalized = normalizeBinanceStatusForDisplay({
      status: "MISSING_ENV",
      testnetEnabled: true,
      liveEnabled: false,
      apiKeyPresent: true,
      apiSecretPresent: true,
      proxyEnabled: true,
      proxyUrlConfigured: true,
      serverTimeOk: false,
      lastCheckedAt: new Date().toISOString(),
      baseUrl: "https://demo-fapi.binance.com",
      reason: "BINANCE_API_KEY / BINANCE_API_SECRET not configured",
      recommendation: "Set keys",
    });
    assert.notEqual(normalized.status, "MISSING_ENV");
    assert.equal(normalized.status, "DISCONNECTED");
  });

  it("binanceStatusForUiPanel never returns MISSING_ENV when keys present", () => {
    const panel = binanceStatusForUiPanel({
      status: "MISSING_ENV",
      testnetEnabled: true,
      liveEnabled: false,
      apiKeyPresent: true,
      apiSecretPresent: true,
      proxyEnabled: true,
      proxyUrlConfigured: true,
      serverTimeOk: false,
      lastCheckedAt: new Date().toISOString(),
      baseUrl: "https://demo-fapi.binance.com",
      reason: "bad",
      recommendation: "bad",
    });
    assert.notEqual(panel.status, "MISSING_ENV");
  });

  it("stale trade banner uses compact message", () => {
    assert.ok(staleTradeBannerText(1).includes("manual repair"));
    assert.ok(staleTradeBannerText(1).includes("active exposure"));
  });

  it("PnL pending label is defined", () => {
    assert.equal(PNL_PENDING_LABEL, "PnL pending — missing fill data.");
  });

  it("dashboard uses useUiProjectionData", () => {
    const src = fs.readFileSync(path.join(process.cwd(), "src", "app", "page.tsx"), "utf8");
    assert.ok(src.includes("useUiProjectionData"));
    assert.ok(src.includes("ui.mission.totalTrades"));
    assert.ok(src.includes("ui.health.status"));
  });

  it("trades page binds closed rows from ui projection", () => {
    const src = fs.readFileSync(path.join(process.cwd(), "src", "app", "trades", "page.tsx"), "utf8");
    assert.ok(src.includes("useUiProjectionData"));
    assert.ok(src.includes("ui.trades.closed.map"));
    assert.ok(src.includes("PNL_PENDING_LABEL"));
  });

  it("core page shows projection source and bundle health", () => {
    const src = fs.readFileSync(path.join(process.cwd(), "src", "app", "core", "page.tsx"), "utf8");
    assert.ok(src.includes("Projection source:"));
    assert.ok(src.includes("ui.mission.closedTrades"));
  });

  it("settings and ai-status use normalized binance status", () => {
    const settings = fs.readFileSync(path.join(process.cwd(), "src", "app", "settings", "page.tsx"), "utf8");
    const ai = fs.readFileSync(path.join(process.cwd(), "src", "app", "ai-status", "page.tsx"), "utf8");
    assert.ok(settings.includes("binanceStatusForUiPanel"));
    assert.ok(ai.includes("binanceStatusForUiPanel"));
  });

  it("provider loads via getUiProjectionData", () => {
    const src = fs.readFileSync(
      path.join(process.cwd(), "src", "components", "projection-bundle-provider.tsx"),
      "utf8",
    );
    assert.ok(src.includes("getUiProjectionData"));
  });

  it("getDefaultUiProjectionData is fallback", () => {
    const ui = getDefaultUiProjectionData();
    assert.equal(ui.source, "FALLBACK");
    assert.equal(ui.isFallback, true);
  });

  it("live trading remains locked", () => {
    assert.equal(isLiveEnabled(), false);
  });

  it("ui projection data does not expose secrets", () => {
    const normalized = normalizeProjectionBundle(productionBundleEnvelope(7));
    const ui = mapNormalizedToUiProjectionData(normalized, { source: "REAL_BUNDLE" });
    const serialized = JSON.stringify(ui);
    assert.ok(!serialized.includes("super-secret"));
    assert.ok(!serialized.includes("BINANCE_API_SECRET=abc"));
  });
});
