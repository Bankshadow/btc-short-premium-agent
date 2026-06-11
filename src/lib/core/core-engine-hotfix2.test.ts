import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { unwrapApiData } from "./projection-api-response";
import { getProjectionBundle } from "./projection-client";
import { getDefaultMissionProjection, getDefaultProjectionBundle } from "./projection-defaults";
import { runProjectionParityCheck } from "./projection-parity";
import { runUiConsistencyCheck } from "./ui-consistency-check";
import { isLiveEnabled } from "@/lib/risk/risk-gate";

describe("Core Engine hotfix 2 — UI projection sync", () => {
  it("unwrapApiData handles nested bundle response", () => {
    const nested = {
      ok: true,
      data: {
        ok: true,
        mission: { totalTrades: 7, currentEquity: 1000, targetCapital: 10000 },
        trades: { open: [], closed: [{ tradeId: "t1" }] },
        pnl: { totalNetPnl: 0 },
        evidence: { valid: 0, required: 12 },
        risk: { liveLocked: true },
        health: { status: "WARNING", exchangeStatus: "CONNECTED", liveLocked: true },
        meta: { eventCount: 7, builtAt: new Date().toISOString(), cacheKey: "7:x" },
      },
      error: null,
    };
    const payload = unwrapApiData<{
      mission: { totalTrades: number };
      health: { exchangeStatus: string };
    }>(nested);
    assert.ok(payload);
    assert.equal(payload!.mission.totalTrades, 7);
    assert.equal(payload!.health.exchangeStatus, "CONNECTED");
  });

  it("dashboard uses real projection bundle values when available", async () => {
    const prev = global.fetch;
    const custom = getDefaultProjectionBundle();
    custom.mission.totalTrades = 7;
    custom.mission.latestVerdict = "TRADE";
    custom.trades.closed = Array.from({ length: 7 }, (_, i) => ({
      tradeId: `t${i}`,
    })) as (typeof custom.trades.closed)[number][];
    custom.trades.open = [];
    custom.trades.openCount = 0;
    custom.trades.closedCount = 7;
    custom.health = {
      ...custom.health,
      exchangeStatus: "CONNECTED",
      status: "WARNING",
    };
    custom.binanceStatus = {
      ...custom.binanceStatus,
      status: "CONNECTED",
      connected: true,
      zeroState: false,
    };

    global.fetch = async (input) => {
      const url = String(input);
      if (url.includes("/api/core/projections/bundle")) {
        return new Response(
          JSON.stringify({
            ok: true,
            data: {
              ok: true,
              mission: custom.mission,
              trades: custom.trades,
              positions: custom.positions,
              pnl: custom.pnl,
              evidence: custom.evidence,
              risk: custom.risk,
              health: custom.health,
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
            data: { status: "CONNECTED", apiKeyPresent: true, apiSecretPresent: true, zeroState: false },
            error: null,
          }),
          { status: 200 },
        );
      }
      throw new Error("unexpected fetch");
    };

    try {
      const bundle = await getProjectionBundle({ timeoutMs: 500, includeBinance: true });
      assert.equal(bundle.mission.totalTrades, 7);
      assert.equal(bundle.mission.latestVerdict, "TRADE");
      assert.equal(bundle.trades.closedCount, 7);
      assert.equal(bundle.ok, true);
      assert.equal(bundle.binanceStatus.status, "CONNECTED");
    } finally {
      global.fetch = prev;
    }
  });

  it("dashboard fallback warning appears when bundle fetch fails", async () => {
    const prev = global.fetch;
    global.fetch = async () => {
      throw new Error("network down");
    };
    try {
      const bundle = await getProjectionBundle({ timeoutMs: 100, includeBinance: false });
      assert.equal(bundle.ok, false);
      assert.ok(
        bundle.warnings.some((w) => w.includes("Projection unavailable")),
        "expected fallback warning",
      );
    } finally {
      global.fetch = prev;
    }
  });

  it("trades page renders without LoadingOrError gate", () => {
    const src = fs.readFileSync(path.join(process.cwd(), "src", "app", "trades", "page.tsx"), "utf8");
    assert.ok(!src.includes("LoadingOrError"));
    assert.ok(src.includes("useUiProjectionData"));
  });

  it("ai-status page renders without LoadingOrError gate", () => {
    const src = fs.readFileSync(path.join(process.cwd(), "src", "app", "ai-status", "page.tsx"), "utf8");
    assert.ok(!src.includes("LoadingOrError"));
    assert.ok(src.includes("useMemo"));
  });

  it("reports page renders without LoadingOrError gate", () => {
    const src = fs.readFileSync(path.join(process.cwd(), "src", "app", "reports", "page.tsx"), "utf8");
    assert.ok(!src.includes("LoadingOrError"));
    assert.ok(src.includes("useMemo"));
  });

  it("settings page renders without LoadingOrError gate", () => {
    const src = fs.readFileSync(path.join(process.cwd(), "src", "app", "settings", "page.tsx"), "utf8");
    assert.ok(!src.includes("LoadingOrError"));
    assert.ok(!src.includes("Loading sandbox status"));
    assert.ok(src.includes("sandboxFallback"));
  });

  it("ui-consistency returns within timeout", async () => {
    const start = Date.now();
    const report = await runUiConsistencyCheck();
    assert.ok(Date.now() - start < 5000, "ui-consistency should finish within 5s");
    assert.ok(["OK", "WARNING", "BLOCKED"].includes(report.status));
    assert.ok(report.lastCheckedAt);
  });

  it("projection-parity returns within timeout", async () => {
    const start = Date.now();
    const report = await runProjectionParityCheck();
    assert.ok(Date.now() - start < 5000, "projection-parity should finish within 5s");
    assert.ok(["OK", "WARNING", "BLOCKED"].includes(report.status));
    assert.ok(report.skippedChecks.length > 0);
  });

  it("no secrets exposed on updated pages", () => {
    for (const rel of ["page.tsx", "trades/page.tsx", "ai-status/page.tsx", "reports/page.tsx", "settings/page.tsx"]) {
      const src = fs.readFileSync(path.join(process.cwd(), "src", "app", rel), "utf8");
      assert.ok(!src.includes("BINANCE_API_SECRET"));
      assert.ok(!src.includes("process.env.BINANCE"));
    }
  });

  it("live remains locked", () => {
    assert.equal(isLiveEnabled(), false);
    const m = getDefaultMissionProjection();
    assert.equal(m.liveLocked, true);
  });
});
