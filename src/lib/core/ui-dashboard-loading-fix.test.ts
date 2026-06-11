import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { getProjectionBundle } from "./projection-client";
import {
  getDefaultProjectionBundle,
  PROJECTION_UNAVAILABLE_MESSAGE,
} from "./projection-defaults";
import { DEFAULT_START_CAPITAL, DEFAULT_TARGET_CAPITAL } from "@/lib/mission/mission-types";
import { isLiveEnabled } from "@/lib/risk/risk-gate";

describe("UI dashboard loading fix", () => {
  it("dashboard renders zero-state when bundle fetch fails", async () => {
    const prev = global.fetch;
    global.fetch = async () => {
      throw new Error("network down");
    };
    try {
      const bundle = await getProjectionBundle({ timeoutMs: 100, includeBinance: false });
      assert.equal(bundle.mission.currentEquity, DEFAULT_START_CAPITAL);
      assert.equal(bundle.mission.targetEquity, DEFAULT_TARGET_CAPITAL);
      assert.equal(bundle.mission.progressPct, 0);
      assert.equal(bundle.trades.openCount, 0);
      assert.equal(bundle.trades.closedCount, 0);
      assert.equal(bundle.pnl.netPnl, 0);
      assert.equal(bundle.evidence.valid, 0);
      assert.equal(bundle.evidence.required, 12);
      assert.equal(bundle.risk.liveLocked, true);
      assert.equal(bundle.ok, false);
      assert.ok(bundle.warnings.includes(PROJECTION_UNAVAILABLE_MESSAGE));
    } finally {
      global.fetch = prev;
    }
  });

  it("dashboard renders projection data when bundle succeeds", async () => {
    const prev = global.fetch;
    const custom = getDefaultProjectionBundle();
    custom.mission.currentEquity = 2500;
    custom.mission.totalTrades = 3;
    custom.trades.open = [{ tradeId: "t-open" } as (typeof custom.trades.open)[number]];
    custom.trades.closed = [
      { tradeId: "t-c1" } as (typeof custom.trades.closed)[number],
      { tradeId: "t-c2" } as (typeof custom.trades.closed)[number],
    ];
    custom.trades.openCount = 1;
    custom.trades.closedCount = 2;
    custom.pnl.totalNetPnl = 42.5;
    custom.evidence.valid = 2;
    custom.ok = true;

    global.fetch = async (input) => {
      const url = String(input);
      if (url.includes("/api/core/projections/bundle")) {
        return new Response(
          JSON.stringify({
            ok: true,
            data: {
              mission: custom.mission,
              trades: custom.trades,
              positions: custom.positions,
              pnl: custom.pnl,
              evidence: custom.evidence,
              risk: custom.risk,
              health: custom.health,
              meta: { eventCount: 3, builtAt: new Date().toISOString(), cacheKey: "test" },
            },
            error: null,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response(
        JSON.stringify({ ok: true, data: custom.binanceStatus, error: null }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    };

    try {
      const bundle = await getProjectionBundle({ timeoutMs: 500, includeBinance: true });
      assert.equal(bundle.mission.currentEquity, 2500);
      assert.equal(bundle.trades.openCount, 1);
      assert.equal(bundle.trades.closedCount, 2);
      assert.equal(bundle.pnl.totalNetPnl, 42.5);
      assert.equal(bundle.evidence.valid, 2);
      assert.equal(bundle.ok, true);
    } finally {
      global.fetch = prev;
    }
  });

  it("dashboard does not stay Loading forever", () => {
    const pageSrc = fs.readFileSync(path.join(process.cwd(), "src", "app", "page.tsx"), "utf8");
    const providerSrc = fs.readFileSync(
      path.join(process.cwd(), "src", "components", "projection-bundle-provider.tsx"),
      "utf8",
    );
    const shellSrc = fs.readFileSync(
      path.join(process.cwd(), "src", "components", "AppShell.tsx"),
      "utf8",
    );
    assert.ok(!pageSrc.includes("LoadingOrError"));
    assert.ok(!pageSrc.includes("if (loading)"));
    assert.ok(pageSrc.includes("useMemo"));
    assert.ok(pageSrc.includes("useProjectionBundle"));
    assert.ok(providerSrc.includes("ProjectionBundleProvider"));
    assert.ok(shellSrc.includes("ProjectionBundleProvider"));
    assert.ok(providerSrc.includes("loading"));
  });

  it("dashboard does not expose secrets", () => {
    const pageSrc = fs.readFileSync(path.join(process.cwd(), "src", "app", "page.tsx"), "utf8");
    assert.ok(!pageSrc.includes("BINANCE_API_SECRET"));
    assert.ok(!pageSrc.includes("process.env"));
  });

  it("live remains locked", () => {
    assert.equal(isLiveEnabled(), false);
    const bundle = getDefaultProjectionBundle();
    assert.equal(bundle.risk.liveLocked, true);
    assert.equal(bundle.mission.liveLocked, true);
  });
});
