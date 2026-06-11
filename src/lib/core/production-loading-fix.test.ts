import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { unwrapProjectionData } from "./projection-api-response";
import {
  fetchWithTimeout,
  getProjectionBundle,
} from "./projection-client";
import {
  getDefaultBinanceStatus,
  getDefaultCoreHealth,
  getDefaultEvidenceProjection,
  getDefaultMissionProjection,
  getDefaultPnlProjection,
  getDefaultPositionProjection,
  getDefaultProjectionBundle,
  getDefaultRiskProjectionView,
  getDefaultTradeProjection,
} from "./projection-defaults";
import { runProjectionRoute } from "./projection-route";
import { zeroDashboardUiContext } from "./ui-context-zero";
import { DEFAULT_START_CAPITAL, DEFAULT_TARGET_CAPITAL } from "@/lib/mission/mission-types";
import { isLiveEnabled } from "@/lib/risk/risk-gate";

describe("Production loading fix", () => {
  it("projection defaults exist with zeroState", () => {
    assert.equal(getDefaultMissionProjection().zeroState, true);
    assert.equal(getDefaultTradeProjection().zeroState, true);
    assert.equal(getDefaultPositionProjection().zeroState, true);
    assert.equal(getDefaultPnlProjection().zeroState, true);
    assert.equal(getDefaultEvidenceProjection().zeroState, true);
    assert.equal(getDefaultRiskProjectionView().zeroState, true);
    assert.equal(getDefaultCoreHealth().zeroState, true);
    assert.equal(getDefaultBinanceStatus().zeroState, true);
    assert.equal(getDefaultProjectionBundle().ok, true);
  });

  it("mission projection returns zero-state", () => {
    const m = getDefaultMissionProjection();
    assert.equal(m.currentEquity, DEFAULT_START_CAPITAL);
    assert.equal(m.targetEquity, DEFAULT_TARGET_CAPITAL);
    assert.equal(m.progressPct, 0);
    assert.equal(m.totalTrades, 0);
    assert.equal(m.openTrades, 0);
    assert.equal(m.closedTrades, 0);
    assert.equal(m.winCount, 0);
    assert.equal(m.lossCount, 0);
    assert.equal(m.breakevenCount, 0);
    assert.equal(m.netPnl, 0);
  });

  it("trades projection returns zero-state", () => {
    const t = getDefaultTradeProjection();
    assert.deepEqual(t.trades, []);
    assert.deepEqual(t.openTrades, []);
    assert.deepEqual(t.closedTrades, []);
    assert.equal(t.totalTrades, 0);
    assert.equal(t.openCount, 0);
    assert.equal(t.closedCount, 0);
  });

  it("positions projection returns zero-state", () => {
    const p = getDefaultPositionProjection();
    assert.deepEqual(p.positions, []);
    assert.equal(p.openPositionCount, 0);
    assert.equal(p.reconciliationStatus, "OK");
    assert.equal(p.message, "No open positions");
  });

  it("pnl projection returns zero-state", () => {
    const p = getDefaultPnlProjection();
    assert.equal(p.realizedPnl, 0);
    assert.equal(p.unrealizedPnl, 0);
    assert.equal(p.netPnl, 0);
    assert.equal(p.latestResult, null);
  });

  it("evidence projection returns zero-state", () => {
    const e = getDefaultEvidenceProjection();
    assert.equal(e.validTrades, 0);
    assert.equal(e.requiredTrades, 12);
    assert.equal(e.progressPct, 0);
    assert.equal(e.readiness, "NOT_READY");
    assert.deepEqual(e.rejectedTrades, []);
  });

  it("risk projection returns zero-state", () => {
    const r = getDefaultRiskProjectionView();
    assert.equal(r.status, "SAFE");
    assert.equal(r.mode, "DEFENSIVE");
    assert.deepEqual(r.blockers, []);
    assert.deepEqual(r.warnings, []);
    assert.equal(r.liveLocked, true);
  });

  it("binance status returns MISSING_ENV without env", () => {
    const b = getDefaultBinanceStatus();
    assert.equal(b.status, "MISSING_ENV");
    assert.equal(b.testnetEnabled, false);
    assert.equal(b.liveEnabled, false);
    assert.equal(b.apiKeyPresent, false);
    assert.equal(b.apiSecretPresent, false);
    assert.equal(b.baseUrl, "https://demo-fapi.binance.com");
    assert.ok(b.reason.includes("BINANCE"));
  });

  it("unwrapProjectionData reads ok envelope with error null", () => {
    const payload = { ok: true, data: { value: 42 }, error: null };
    assert.deepEqual(unwrapProjectionData<{ value: number }>(payload), { value: 42 });
  });

  it("unwrapProjectionData returns null for invalid shape", () => {
    assert.equal(unwrapProjectionData(null), null);
    assert.equal(unwrapProjectionData({ ok: true }), null);
  });

  it("projection client fallback works on fetch error", async () => {
    const prev = global.fetch;
    global.fetch = async () => {
      throw new Error("network down");
    };
    try {
      const result = await fetchWithTimeout(
        "/api/core/projections/mission",
        getDefaultMissionProjection(),
        100,
      );
      assert.equal(result.usedFallback, true);
      assert.equal(result.data.zeroState, true);
      assert.ok(result.error);
    } finally {
      global.fetch = prev;
    }
  });

  it("projection client fallback works on timeout", async () => {
    const prev = global.fetch;
    global.fetch = (_url, init) =>
      new Promise((_resolve, reject) => {
        const signal = init?.signal;
        if (signal) {
          signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
        }
      });
    try {
      const result = await fetchWithTimeout(
        "/api/core/projections/trades",
        getDefaultTradeProjection(),
        50,
      );
      assert.equal(result.usedFallback, true);
      assert.equal(result.data.openCount, 0);
    } finally {
      global.fetch = prev;
    }
  });

  it("projection bundle returns partial data when one API fails", async () => {
    const prev = global.fetch;
    let calls = 0;
    global.fetch = async (input) => {
      calls += 1;
      const url = String(input);
      if (url.includes("/mission")) {
        return new Response(JSON.stringify({ ok: false, data: null, error: { code: "X" } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(
        JSON.stringify({ ok: true, data: getDefaultPnlProjection(), error: null }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    };
    try {
      const bundle = await getProjectionBundle({ timeoutMs: 200, includeBinance: false });
      assert.equal(bundle.mission.zeroState, true);
      assert.ok(bundle.warnings.length > 0);
      assert.ok(calls >= 2);
    } finally {
      global.fetch = prev;
    }
  });

  it("mission projection route returns envelope on failure", async () => {
    const res = await runProjectionRoute("mission", getDefaultMissionProjection(), () => {
      throw new Error("journal missing");
    });
    const body = await res.json();
    assert.equal(body.ok, false);
    assert.equal(body.data.zeroState, true);
    assert.equal(body.error.code, "PROJECTION_FALLBACK");
  });

  it("dashboard ui context zero-state is immediately renderable", () => {
    const ctx = zeroDashboardUiContext();
    assert.equal(ctx.executionSafetyStatus, "no_preview");
    assert.equal(ctx.latestPreview, null);
    assert.equal(ctx.binanceStatus.status, "MISSING_ENV");
  });

  it("no page relies on endless Loading", () => {
    const root = path.join(process.cwd(), "src", "app");
    const pages = [
      "page.tsx",
      "trades/page.tsx",
      "ai-status/page.tsx",
      "reports/page.tsx",
      "settings/page.tsx",
    ];
    for (const rel of pages) {
      const src = fs.readFileSync(path.join(root, rel), "utf8");
      assert.ok(
        !src.includes("if (pending) return pending"),
        `${rel} must not block entire page on LoadingOrError`,
      );
      assert.ok(src.includes("ProjectionWarningPanel"), `${rel} must show warning panel`);
    }
  });

  it("boot-check payload shape excludes secrets", () => {
    const sample = JSON.stringify({
      ok: true,
      app: "btc-short-premium-agent",
      corePagesShouldRender: true,
      zeroStateReady: true,
      apis: { coreHealth: "OK", missionProjection: "OK" },
      criticalIssues: [],
      warnings: [],
      checkedAt: new Date().toISOString(),
    });
    assert.ok(!sample.toLowerCase().includes("apisecret"));
    assert.ok(!sample.toLowerCase().includes("binance_api_secret"));
  });

  it("live trading remains locked", () => {
    assert.equal(isLiveEnabled(), false);
    assert.equal(getDefaultCoreHealth().liveLocked, true);
  });
});
